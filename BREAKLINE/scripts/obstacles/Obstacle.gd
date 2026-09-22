extends Area3D
class_name Obstacle
## Obstacle
## A rail-blocking hazard -- a piece of the facility's own infrastructure
## closing on you, not a generic "wall." Ends the run if the player's
## HitDetector overlaps it while still ACTIVE.
##
## The player cannot dodge (see PlayerController's single-rail control
## model), so an obstacle is never avoided by steering. It is cleared by
## shooting its WeakPoint -- the exposed actuator node. Shooting the body
## does nothing but spark. This is what makes aiming the only verb the
## game needs.
##
## Because it only has to cover the rail rather than a lane the player
## might be anywhere in, it is deliberately NARROW: it blocks the line
## without filling the screen, which was the single biggest readability
## complaint from the device test.
##
## Telegraph, in order: it scales in over ~0.3 s, its warning stripe
## pulses the whole time it is active, and its weak point glows cyan --
## the one part the player is meant to look at.

const SPAWN_TELEGRAPH_TIME := 0.3
## How long the withdraw-out-of-the-rail animation takes once the actuator
## is cut. Short: the player has already earned the pass.
const RETRACT_TIME := 0.32
## How close to the actuator a dart has to land. Generous on purpose: this
## is a phone, the hazard is moving toward the player, and the skill being
## asked for is "notice it and answer it in time", not "hit a 17 cm sphere
## at 40 m". Precision is rewarded elsewhere (a shard's core).
const WEAK_POINT_RADIUS := 0.46

## Physics layer bits (named in project.godot).
const LAYER_HAZARD := 8
const LAYER_SOLID := 64

## What this hazard is made of. MECHANICAL is matter -- a blast door, a
## support beam -- so it stops a Kinetic Dart. ENERGY is a field: it ends
## the player's run but a dart passes straight through it.
##
## This is a gameplay rule the player has to be able to read off the
## OBJECT, which is why it lives next to the visuals rather than in a
## spawn table: anything using ENERGY must look like a field, and anything
## using MECHANICAL must look solid.
enum Kind { MECHANICAL, ENERGY }

@export var kind: Kind = Kind.MECHANICAL

## The DANGER material. Warm orange is reserved in the colour system for
## "this will end your run" -- see docs/ART_DIRECTION.md -- so nothing but
## an obstacle is allowed to use it.
const DANGER_MATERIAL := preload("res://assets/materials/danger_material.tres")

## Awarded for cutting the actuator. Lower than a Containment Shard's 100
## on purpose: clearing a hazard is survival, not marksmanship, and the
## score should not push players to hunt hazards over shards.
@export var clear_score: int = 60

@onready var _collision: CollisionShape3D = $Collision
@onready var _mesh: MeshInstance3D = $Mesh if has_node("Mesh") else null
@onready var _weak_point: MeshInstance3D = $WeakPoint if has_node("WeakPoint") else null

var _danger_material: ShaderMaterial

var _telegraph_elapsed: float = 0.0
var _pulse_time: float = 0.0
var _is_active: bool = false
var _retract_elapsed: float = -1.0
var _spawn_height: float = 0.0

func _ready() -> void:
	add_to_group("obstacle")
	# Always a hazard to the player; only MECHANICAL kinds also occupy the
	# solid layer the Kinetic Dart collides with.
	collision_layer = LAYER_HAZARD | (LAYER_SOLID if kind == Kind.MECHANICAL else 0)
	monitorable = false
	# One duplicate per pooled obstacle. Without this every obstacle writes
	# the same shared material and they all pulse in lockstep, which is
	# exactly the "these are copies" read a hazard must not have.
	if _mesh:
		_danger_material = DANGER_MATERIAL.duplicate() as ShaderMaterial
		_mesh.material_override = _danger_material

func spawn_reset(local_position: Vector3) -> void:
	position = local_position
	_spawn_height = local_position.y
	visible = true
	monitorable = true
	_is_active = true
	_telegraph_elapsed = 0.0
	_pulse_time = randf_range(0.0, TAU)
	_retract_elapsed = -1.0
	scale = Vector3(1.0, 0.1, 1.0)
	if _collision:
		_collision.disabled = false
	if _weak_point:
		_weak_point.visible = true

func recycle() -> void:
	_is_active = false
	_retract_elapsed = -1.0
	visible = false
	monitorable = false
	if _collision:
		_collision.disabled = true

## Geometry test used by Projectile instead of a second Area3D. Keeping
## the actuator as a visual-only node means one less Area3D per pooled
## hazard AND removes the same-frame ordering race between two overlapping
## areas -- see the note at the call site.
func is_weak_point_hit(world_position: Vector3) -> bool:
	if _weak_point == null or not _is_active or _retract_elapsed >= 0.0:
		return false
	return world_position.distance_to(_weak_point.global_position) <= WEAK_POINT_RADIUS

## Called from Projectile when a dart reaches the actuator node. The
## hazard stops being lethal IMMEDIATELY -- the retract is presentation,
## and a player who made the shot must never be killed by the animation
## still playing.
##
## Runs inside a physics signal, so every collision-state write here is
## deferred (the same trap GlassTarget hit: Godot silently drops those
## writes mid-query-flush).
func clear_by_weak_point(impact_position: Vector3) -> void:
	if not _is_active or _retract_elapsed >= 0.0:
		return
	_retract_elapsed = 0.0
	set_deferred("monitorable", false)
	if _collision:
		_collision.set_deferred("disabled", true)

	VFXManager.spawn_impact_flash(impact_position, Color(0.55, 0.95, 1.0), 2.2, 0.14)
	VFXManager.spawn_core_flare(impact_position, Color(0.6, 0.95, 1.0), 1.0)
	VFXManager.request_camera_shake(0.22, 0.16)
	VFXManager.trigger_haptic(0.5)
	AudioManager.play_sfx("glass_shatter")
	AudioManager.play_sfx("target_hit")

	ComboManager.register_hit()
	ScoreManager.add_target_hit(clear_score, false)

func _process(delta: float) -> void:
	if not _is_active:
		return

	# Retracting: the actuator is cut, so the hazard withdraws upward out
	# of the rail. Purely visual -- it is already harmless.
	if _retract_elapsed >= 0.0:
		_retract_elapsed += delta
		var r := clampf(_retract_elapsed / RETRACT_TIME, 0.0, 1.0)
		scale = Vector3(1.0, maxf(1.0 - r, 0.02), 1.0)
		position.y = _spawn_height + r * 2.4
		if r >= 1.0:
			visible = false
		return

	if _telegraph_elapsed < SPAWN_TELEGRAPH_TIME:
		_telegraph_elapsed += delta
		var t := clampf(_telegraph_elapsed / SPAWN_TELEGRAPH_TIME, 0.0, 1.0)
		scale = Vector3(1.0, lerpf(0.1, 1.0, t), 1.0)

	# Stripe pulse. Range is deliberately narrow (0.75 .. 1.45 on top of the
	# material's own 1.6 emission): a hazard has to stay legible without
	# strobing, and it shares the screen with the impact flashes.
	if _danger_material:
		_pulse_time += delta
		var pulse := 1.1 + 0.35 * sin(_pulse_time * 5.0)
		_danger_material.set_shader_parameter("pulse", pulse)
