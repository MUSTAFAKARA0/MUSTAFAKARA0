extends Node3D
class_name PlayerController
## PlayerController
## Drives the endless-runner half of gameplay: forward motion along a
## fixed rail, and wiring InputManager's tap/drag signals into aiming and
## firing. The player is never a visible 3D model -- everything is
## felt through the camera (see CameraController.gd).
##
## CONTROL MODEL (docs/GAMEPLAY.md) -- SINGLE RAIL
##   DRAG -> aim. Moves the reticle and leans the camera. Nothing else.
##   TAP  -> fire a Kinetic Dart at the reticle.
##
## The player travels a FIXED LINE and cannot move sideways at all. This
## is the whole control model, and it is deliberate: one finger cannot
## serve both "aim precisely at a small shard 40 m away" and "dodge now"
## without the two fighting each other. Earlier versions tried a
## deadzoned lean; even then the same finger still owned both jobs.
##
## The consequence is load-bearing: with no dodge, a hazard can no longer
## be something you steer around, so every hazard must be SHOOTABLE.
## See Obstacle.gd -- hazards carry an exposed actuator node, and
## destroying it retracts the hazard. That is what makes aiming the only
## verb the game needs, and why shooting is now mandatory rather than
## optional scoring.

## ---- forward motion -------------------------------------------------
@export var base_forward_speed: float = 12.0
@export var max_forward_speed: float = 26.0
@export var speed_ramp_per_second: float = 0.15

@export var muzzle_projectile_speed: float = 46.0

## Speed lost for ramming an unshot Containment Shard, and how fast it
## comes back. A shard costs about half a second of progress -- enough to
## feel, nowhere near enough to end a run.
@export var shard_impact_speed_cost: float = 2.6
@export var shard_impact_max_penalty: float = 4.4
@export var speed_penalty_recovery: float = 2.2

var forward_speed: float = 0.0

var _cruise_speed: float = 0.0
var _speed_penalty: float = 0.0
var _aim_norm: Vector2 = Vector2.ZERO

@onready var camera: CameraController = $Camera3D
@onready var muzzle: Marker3D = $Camera3D/MuzzlePoint
@onready var hit_detector: Area3D = $HitDetector

func _ready() -> void:
	_cruise_speed = base_forward_speed
	forward_speed = base_forward_speed
	InputManager.aim_touch_started.connect(_on_aim_touch_started)
	InputManager.aim_touch_moved.connect(_on_aim_touch_moved)
	InputManager.shoot_requested.connect(_on_shoot_requested)
	hit_detector.area_entered.connect(_on_hazard_entered)
	hit_detector.body_entered.connect(_on_hazard_entered)

func _process(delta: float) -> void:
	if GameManager.current_state != GameManager.State.PLAYING:
		return
	_advance_forward(delta)

## Cruise speed ramps up over the run; the penalty from a shard impact
## sits on top of it and decays independently. Keeping them separate means
## a collision dip always recovers in about a second regardless of how far
## into the run it happens -- folded into cruise speed it would take 30+
## seconds to claw back at the ramp rate.
func _advance_forward(delta: float) -> void:
	_cruise_speed = minf(_cruise_speed + speed_ramp_per_second * delta, max_forward_speed)
	_speed_penalty = maxf(_speed_penalty - speed_penalty_recovery * delta, 0.0)
	forward_speed = maxf(_cruise_speed - _speed_penalty, base_forward_speed * 0.45)

	global_position.z -= forward_speed * delta
	GameManager.distance_traveled += forward_speed * delta

## Normalised reticle position (-1..1 on both axes). CameraController uses
## it for the aim lean; HUD uses it to put the crosshair where the shot
## will actually go.
func get_aim_norm() -> Vector2:
	return _aim_norm

func _update_aim_norm(screen_pos: Vector2) -> void:
	var viewport_size := get_viewport().get_visible_rect().size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		return
	_aim_norm = Vector2(
		(screen_pos.x / viewport_size.x) * 2.0 - 1.0,
		(screen_pos.y / viewport_size.y) * 2.0 - 1.0
	)

func _on_aim_touch_started(screen_pos: Vector2) -> void:
	_update_aim_norm(screen_pos)

func _on_aim_touch_moved(screen_pos: Vector2, _relative: Vector2) -> void:
	_update_aim_norm(screen_pos)

func _on_shoot_requested(screen_pos: Vector2) -> void:
	if GameManager.current_state != GameManager.State.PLAYING:
		return
	_update_aim_norm(screen_pos)

	var direction := camera.project_ray_normal(screen_pos)
	ProjectileManager.fire("kinetic_dart", muzzle.global_position, direction, muzzle_projectile_speed)
	camera.apply_recoil(0.05)
	AudioManager.play_sfx("projectile_fire")
	GameManager.register_shot_fired()

## Two very different outcomes share this one Area3D, and which one fires
## is decided by WHAT was hit, never by which layer it arrived on -- see
## the core loop contract in docs/GAMEPLAY.md.
func _on_hazard_entered(other: Node) -> void:
	var target := other as GlassTarget
	if target:
		if target.blocks_player():
			_on_shard_rammed(target)
		# A fake shard is deliberately harmless to ram. "Shoot this" and
		# "avoid this" must stay separate signals.
		return

	var obstacle := other as Obstacle
	if obstacle:
		_on_obstacle_hit()

## Ramming a real shard: costs speed and the combo, never the run.
func _on_shard_rammed(target: GlassTarget) -> void:
	_speed_penalty = minf(_speed_penalty + shard_impact_speed_cost, shard_impact_max_penalty)
	ComboManager.break_combo()
	VFXManager.request_camera_shake(0.34, 0.22)
	VFXManager.trigger_haptic(0.6)
	AudioManager.play_sfx("combo_break")
	target.collapse_on_impact(target.global_position)

func _on_obstacle_hit() -> void:
	VFXManager.request_camera_shake(0.5, 0.3)
	VFXManager.trigger_haptic(1.0)
	AudioManager.play_sfx("obstacle_collision")
	GameManager.trigger_game_over()
