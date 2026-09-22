extends Node
## VFXManager
## Pooled particle bursts, camera shake requests and haptics. Kept
## independent of any specific scene so targets/obstacles/projectiles can
## all ask for feedback without knowing about the camera or each other.

signal camera_shake_requested(strength: float, duration: float)
signal hit_flash_requested(world_position: Vector3)

const POOL_SIZE := 16
const FLASH_POOL_SIZE := 6
## Small on purpose. The core flare is the single loudest beat in the
## destruction sequence; if four can be on screen at once it stops being
## a beat and becomes the background.
const FLARE_POOL_SIZE := 4

## Hard ceiling on impact-flash light energy. Materials ask for
## core_emission_energy * 1.6 on a precision hit, and an uncapped value
## there washes the facility's dark structural base out to grey -- which
## breaks the whole lighting hierarchy for the sake of one frame.
const MAX_FLASH_ENERGY := 3.2

var _pool: Array[CPUParticles3D] = []
var _pool_index: int = 0

var _flash_pool: Array[OmniLight3D] = []
var _flash_pool_index: int = 0

var _flare_pool: Array[MeshInstance3D] = []
var _flare_materials: Array[StandardMaterial3D] = []
var _flare_tweens: Array[Tween] = []
var _flare_index: int = 0

var _hit_pause_active: bool = false

func _ready() -> void:
	for i in range(POOL_SIZE):
		var particles := _build_particle_node()
		add_child(particles)
		_pool.append(particles)

	for i in range(FLASH_POOL_SIZE):
		var light := _build_flash_light()
		add_child(light)
		_flash_pool.append(light)

	# One shared low-poly sphere mesh, one material per slot (the material
	# is what animates, so it cannot be shared).
	var flare_mesh := SphereMesh.new()
	flare_mesh.radius = 0.18
	flare_mesh.height = 0.36
	flare_mesh.radial_segments = 8
	flare_mesh.rings = 4
	for i in range(FLARE_POOL_SIZE):
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		mat.disable_receive_shadows = true
		mat.albedo_color = Color(0.5, 0.9, 1.0, 0.0)

		var flare := MeshInstance3D.new()
		flare.mesh = flare_mesh
		flare.material_override = mat
		flare.visible = false
		flare.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(flare)

		_flare_pool.append(flare)
		_flare_materials.append(mat)
		_flare_tweens.append(null)

func _build_particle_node() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.emitting = false
	p.one_shot = true
	p.amount = 24
	p.lifetime = 0.6
	p.explosiveness = 1.0
	p.direction = Vector3(0, 1, 0)
	p.spread = 180.0
	p.gravity = Vector3(0, -9.0, 0)
	p.initial_velocity_min = 2.0
	p.initial_velocity_max = 6.0
	p.scale_amount_min = 0.05
	p.scale_amount_max = 0.12
	p.mesh = BoxMesh.new()
	return p

func _build_flash_light() -> OmniLight3D:
	var light := OmniLight3D.new()
	light.light_energy = 0.0
	light.omni_range = 4.0
	light.shadow_enabled = false
	return light

## Instant bright pop of light at the impact point that decays over
## `duration` -- the "something just happened here" read that a particle
## burst alone is too slow to sell. Pooled the same way as spawn_burst().
func spawn_impact_flash(world_position: Vector3, color: Color, energy: float = 6.0, duration: float = 0.12) -> void:
	var light := _flash_pool[_flash_pool_index]
	_flash_pool_index = (_flash_pool_index + 1) % _flash_pool.size()

	light.global_position = world_position
	light.light_color = color
	light.light_energy = minf(energy, MAX_FLASH_ENERGY)

	var tween := create_tween()
	tween.tween_property(light, "light_energy", 0.0, duration)

## CORE REACTION -- beat 3 of the destruction sequence (impact, fracture,
## CORE REACTION, fragment response, inward pull, dissolve). The shard's
## energy core is what the player was aiming at, so its release gets its
## own read: a short additive bloom that expands out of the impact point
## and is gone in ~0.22s, before the fragments have finished their outward
## phase. Deliberately separate from spawn_impact_flash: that one lights
## the SURROUNDINGS (so you see where the hit landed in the world), this
## one is the object itself letting go.
func spawn_core_flare(world_position: Vector3, color: Color, strength: float = 1.0) -> void:
	if _flare_pool.is_empty():
		return

	var index := _flare_index
	_flare_index = (_flare_index + 1) % _flare_pool.size()

	var flare := _flare_pool[index]
	var mat := _flare_materials[index]
	var previous: Tween = _flare_tweens[index]
	if previous and previous.is_valid():
		previous.kill()

	flare.global_position = world_position
	flare.scale = Vector3.ONE * 0.45
	flare.visible = true

	# Additive, so alpha is effectively "how much light to add". 0.7 at
	# strength 1.0 rather than a full 1.0: stacked on the impact flash and
	# the burst this already reads as bright, and going higher clipped the
	# shard's own rim out of the frame it matters most in.
	var peak := clampf(0.7 * strength, 0.0, 0.95)
	mat.albedo_color = Color(color.r, color.g, color.b, peak)

	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(flare, "scale", Vector3.ONE * (2.6 * strength), 0.22) \
		.set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tween.tween_property(mat, "albedo_color:a", 0.0, 0.22) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(func() -> void: flare.visible = false)
	_flare_tweens[index] = tween

## Spawns a one-shot particle burst at world_position using color.
## color_variance widens the hue slightly for more natural fragments.
func spawn_burst(world_position: Vector3, color: Color, amount: int = 24) -> void:
	var particles := _pool[_pool_index]
	_pool_index = (_pool_index + 1) % _pool.size()

	particles.global_position = world_position
	particles.amount = amount
	particles.color = color
	particles.restart()
	particles.emitting = true

	hit_flash_requested.emit(world_position)

func request_camera_shake(strength: float = 0.3, duration: float = 0.15) -> void:
	camera_shake_requested.emit(strength, duration)

## A brief, safe global time-scale dip -- the "micro-freeze" on a
## precision hit. Reserved for precision hits only (see GlassTarget.
## take_hit); using it on every hit would turn combo chains into a
## stutter. `duration` is real (wall-clock) time regardless of the scale
## dip, via SceneTree's ignore_time_scale timer, so it always feels like
## the same short punch no matter the scale factor. Re-entrancy-guarded
## so overlapping precision hits can't stack dips into a longer freeze.
func request_hit_pause(scale: float = 0.25, duration: float = 0.06) -> void:
	if _hit_pause_active:
		return
	_hit_pause_active = true
	Engine.time_scale = scale
	await get_tree().create_timer(duration, true, false, true).timeout
	Engine.time_scale = 1.0
	_hit_pause_active = false

func trigger_haptic(strength: float = 0.5) -> void:
	if not SettingsManager.haptics_enabled:
		return
	if OS.get_name() != "Android":
		return
	Input.vibrate_handheld(int(clamp(strength, 0.0, 1.0) * 60))
