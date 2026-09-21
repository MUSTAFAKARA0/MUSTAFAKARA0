extends Area3D
class_name GlassTarget
## GlassTarget
## A destructible "Containment Shard" -- an asymmetric faceted cluster
## with a visible energy core. Two independent, swappable pieces decide
## everything about one instance:
##   - `behavior` (TargetBehavior): what KIND of target this is
##     (normal/fake/moving/... later armored/timed/shielded/...) --
##     decides on_hit scoring and any per-frame motion.
##   - `material` (MaterialProfile): what SUBSTANCE it's made of
##     (glass/crystal/metal/...) -- decides appearance, fracture physics,
##     audio, and score multiplier.
## GlassTarget itself only orchestrates: it never hardcodes "this is a
## fake target" or "this is glass" logic. See docs/TARGETS.md and
## docs/MATERIALS.md.

signal shattered(target: Node)

## World-space distance from the core within which a hit counts as
## "precision" -- bigger combo/score/feedback, see take_hit().
const PRECISION_RADIUS := 0.42

## The shared Containment Crystal shader (see docs/ART_DIRECTION.md's
## material language). Each pooled target duplicates it ONCE in _ready()
## and thereafter only pushes uniform values -- so changing material
## profile per spawn costs no allocation at all.
const CRYSTAL_MATERIAL := preload("res://assets/materials/containment_crystal.tres")

@export var move_amplitude: float = 1.4
@export var move_speed: float = 1.1

var base_points: int = 100
var coin_reward: int = 2

var move_time: float = 0.0
var base_local_x: float = 0.0

var _behavior: TargetBehavior
var _material: MaterialProfile
var _is_shattered: bool = true
var _core_flicker_time: float = 0.0
var _move_phase: float = 0.0
var _move_speed_variance: float = 1.0

@onready var _facets: Array[MeshInstance3D] = _collect_facets()
@onready var _core: MeshInstance3D = $Core
@onready var _collision: CollisionShape3D = $Collision

var _facet_material: ShaderMaterial
var _core_material: StandardMaterial3D

func _collect_facets() -> Array[MeshInstance3D]:
	var out: Array[MeshInstance3D] = []
	var facets_root := get_node("Facets")
	for child in facets_root.get_children():
		var mesh_child := child as MeshInstance3D
		if mesh_child:
			mesh_child.set_meta("base_rotation", mesh_child.rotation)
			out.append(mesh_child)
	return out

func _ready() -> void:
	add_to_group("target")
	monitorable = false
	monitoring = false
	_build_instance_materials()

## One duplicate per pooled instance, created once. Every later spawn only
## writes uniform values onto these, so a target changing material profile
## (glass -> unstable signal -> a future metal) allocates nothing.
func _build_instance_materials() -> void:
	_facet_material = CRYSTAL_MATERIAL.duplicate() as ShaderMaterial
	for facet in _facets:
		facet.material_override = _facet_material

	# The core is intentionally NOT the crystal shader: it must read as a
	# solid, opaque light source sitting inside translucent facets, which
	# is what makes "the core is the thing that matters" legible at a
	# glance. An unshaded emissive material does that in one draw.
	_core_material = StandardMaterial3D.new()
	_core_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if _core:
		_core.material_override = _core_material

## TargetManager always calls spawn_reset() right after this, which is
## what actually applies visuals -- avoids allocating materials twice
## per spawn.
func configure(behavior: TargetBehavior, material: MaterialProfile, points: int, coins: int = 2) -> void:
	_behavior = behavior
	_material = material
	base_points = points
	coin_reward = coins

## Pushes the profile onto the already-owned instance materials. No
## allocation, no material swap -- only uniform writes.
##
## The facet tint keeps the profile's alpha but is clamped away from fully
## opaque: a Containment Shard has to stay see-through enough that the core
## is visible THROUGH it, because "the core is the thing that matters" is
## read from the silhouette, not from a tooltip.
func _apply_visuals() -> void:
	if not _material or not _facet_material:
		return

	var tint := _material.albedo_color
	tint.a = clampf(tint.a, 0.18, 0.55)
	_facet_material.set_shader_parameter("tint_color", tint)
	_facet_material.set_shader_parameter("rim_color", _material.emission_color)
	_facet_material.set_shader_parameter("emission_strength", _material.emission_energy)
	_facet_material.set_shader_parameter("fade", 1.0)

	# An unstable/fake shard gets a harder, tighter rim so its edges read as
	# brittle rather than softly lit -- the second of three independent
	# tells (shape, rim/material behaviour, core flicker).
	var is_fake := _behavior != null and _behavior.get_id() == "fake"
	_facet_material.set_shader_parameter("rim_power", 5.2 if is_fake else 3.0)
	_facet_material.set_shader_parameter("rim_strength", 3.1 if is_fake else 2.2)
	_facet_material.set_shader_parameter("surface_roughness", 0.30 if is_fake else 0.12)

	# UNSHADED writes ALBEDO straight to the framebuffer -- `emission` is
	# not applied in that mode -- so the core's overdrive has to live in the
	# albedo colour itself. Kept to ~1.9x rather than the raw profile energy
	# so the core reads as a bright light and not as a white blob that eats
	# the facets around it.
	if _core and _core_material:
		var core_gain := clampf(_material.core_emission_energy * 0.55, 0.9, 1.9)
		var core_albedo := _material.core_color * core_gain
		core_albedo.a = 1.0
		_core_material.albedo_color = core_albedo
		_core.scale = Vector3.ONE

func spawn_reset(local_position: Vector3) -> void:
	position = local_position
	base_local_x = local_position.x
	move_time = 0.0
	_move_phase = randf_range(0.0, TAU)
	_move_speed_variance = randf_range(0.85, 1.15)
	_core_flicker_time = 0.0
	_is_shattered = false
	visible = true
	monitorable = true
	if _collision:
		_collision.disabled = false

	# Silhouette tell #1. A real shard is a compact faceted cluster; a fake
	# one is stretched thin and vertically spiky, with irregular per-facet
	# jitter on top. That difference survives at distance, at low
	# brightness, and for a colour-blind player -- which is the whole point
	# of not making "fake" mean "red".
	var is_fake := _behavior != null and _behavior.get_id() == "fake"
	var fake_scale := Vector3(0.78, 1.34, 0.78)
	for facet in _facets:
		var base_rotation: Vector3 = facet.get_meta("base_rotation", Vector3.ZERO)
		facet.rotation = base_rotation
		if is_fake:
			facet.rotation += Vector3(
				randf_range(-0.16, 0.16),
				randf_range(-0.16, 0.16),
				randf_range(-0.16, 0.16)
			)
			facet.scale = fake_scale
		else:
			facet.scale = Vector3.ONE

	_apply_visuals()

func core_world_position() -> Vector3:
	return _core.global_position if _core else global_position

## Called by FakeTargetBehavior every frame: an irregular pulse (two
## uneven sine terms) instead of a steady glow, so a fake target's core
## visibly flickers rather than holding a calm light like a real one.
func update_flicker(delta: float) -> void:
	if not _core:
		return
	_core_flicker_time += delta
	var pulse := 0.5 + 0.35 * sin(_core_flicker_time * 13.0) + 0.15 * sin(_core_flicker_time * 27.0 + 1.3)
	_core.scale = Vector3.ONE * (0.75 + pulse * 0.4)

## Called by MovingTargetBehavior every frame: two summed sine waves at
## different frequency/phase read as an organic drift instead of a single
## metronomic sine.
func advance_moving_motion(delta: float) -> void:
	move_time += delta * _move_speed_variance
	var primary := sin(move_time * move_speed + _move_phase) * move_amplitude
	var secondary := sin(move_time * move_speed * 2.3 + _move_phase * 1.7) * move_amplitude * 0.18
	position.x = base_local_x + primary + secondary

func _process(delta: float) -> void:
	if _is_shattered or _behavior == null:
		return
	_behavior.on_process(self, delta)

func take_hit(hit_position: Vector3, hit_normal: Vector3, projectile_direction: Vector3) -> void:
	if _is_shattered or _material == null or _behavior == null:
		return
	_is_shattered = true
	monitorable = false
	visible = false
	if _collision:
		_collision.disabled = true

	var is_precision := hit_position.distance_to(core_world_position()) <= PRECISION_RADIUS

	# The destruction sequence, in the order the player reads it:
	#   1. IMPACT          -- flash lights the surroundings at the hit point
	#   2. FRACTURE        -- the shard's body becomes fragments
	#   3. CORE REACTION   -- the energy core lets go (bigger on a precision
	#                         hit, because that IS the core shot)
	#   4. FRAGMENT RESPONSE / 5. INWARD PULL / 6. DISSOLVE -- all owned by
	#      GlassFragment's two-phase lifecycle from here on.
	# The particle burst is deliberately last and smallest: it is texture
	# on top of the sequence, not one of its beats.
	VFXManager.spawn_impact_flash(
		hit_position,
		_material.core_color,
		_material.core_emission_energy * (1.5 if is_precision else 0.9)
	)
	FragmentManager.shatter_at(hit_position, hit_normal, projectile_direction, _material)
	VFXManager.spawn_core_flare(
		core_world_position(),
		_material.core_color,
		1.25 if is_precision else 0.85
	)
	VFXManager.spawn_burst(hit_position, _material.emission_color, 18)
	VFXManager.request_camera_shake(
		_material.camera_shake_strength * (1.4 if is_precision else 1.0),
		_material.camera_shake_duration
	)
	VFXManager.trigger_haptic(_material.haptic_strength)
	AudioManager.play_sfx(_material.sfx_crack)
	AudioManager.play_sfx(_material.sfx_shatter)
	if is_precision:
		VFXManager.request_hit_pause()
		AudioManager.play_sfx("perfect_hit")

	var scored := _behavior.on_hit(self)
	if scored:
		ComboManager.register_hit()
		ScoreManager.add_target_hit(int(round(base_points * _material.score_multiplier)), is_precision)
		GameManager.add_coins(coin_reward)
		AudioManager.play_sfx("target_hit")
	else:
		AudioManager.play_sfx("combo_break")
		ComboManager.break_combo()

	shattered.emit(self)
