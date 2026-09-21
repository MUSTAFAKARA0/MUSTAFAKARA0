extends Node3D
class_name PlayerController
## PlayerController
## Drives the endless-runner half of gameplay: constant forward motion
## (speeding up over time), subtle lane steering toward the touch reticle,
## and wiring InputManager's tap/drag signals into aiming + firing.
## The player is never a visible 3D model -- everything is felt through
## the camera (see CameraController.gd).

@export var base_forward_speed: float = 12.0
@export var max_forward_speed: float = 26.0
@export var speed_ramp_per_second: float = 0.15
@export var lane_half_width: float = 3.2
@export var steer_smoothing: float = 6.0
@export var muzzle_projectile_speed: float = 46.0

var forward_speed: float = 0.0
var _reticle_norm: Vector2 = Vector2.ZERO
var _target_x: float = 0.0
var _lateral_velocity: float = 0.0

@onready var camera: CameraController = $Camera3D
@onready var muzzle: Marker3D = $Camera3D/MuzzlePoint
@onready var hit_detector: Area3D = $HitDetector

func _ready() -> void:
	forward_speed = base_forward_speed
	InputManager.aim_touch_started.connect(_on_aim_touch_started)
	InputManager.aim_touch_moved.connect(_on_aim_touch_moved)
	InputManager.shoot_requested.connect(_on_shoot_requested)
	hit_detector.area_entered.connect(_on_hazard_entered)
	hit_detector.body_entered.connect(_on_hazard_entered)

func _process(delta: float) -> void:
	if GameManager.current_state != GameManager.State.PLAYING:
		return
	forward_speed = min(forward_speed + speed_ramp_per_second * delta, max_forward_speed)
	global_position.z -= forward_speed * delta
	GameManager.distance_traveled += forward_speed * delta

	_target_x = clamp(_reticle_norm.x, -1.0, 1.0) * lane_half_width
	var prev_x := global_position.x
	global_position.x = lerp(global_position.x, _target_x, delta * steer_smoothing)
	if delta > 0.0:
		_lateral_velocity = (global_position.x - prev_x) / delta

## Used by CameraController to bank the camera slightly into a turn --
## purely cosmetic, doesn't affect the actual steering above.
func get_lateral_velocity() -> float:
	return _lateral_velocity

func _update_reticle_norm(screen_pos: Vector2) -> void:
	var viewport_size := get_viewport().get_visible_rect().size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		return
	_reticle_norm = Vector2(
		(screen_pos.x / viewport_size.x) * 2.0 - 1.0,
		(screen_pos.y / viewport_size.y) * 2.0 - 1.0
	)

func _on_aim_touch_started(screen_pos: Vector2) -> void:
	_update_reticle_norm(screen_pos)

func _on_aim_touch_moved(screen_pos: Vector2, _relative: Vector2) -> void:
	_update_reticle_norm(screen_pos)

func _on_shoot_requested(screen_pos: Vector2) -> void:
	if GameManager.current_state != GameManager.State.PLAYING:
		return
	_update_reticle_norm(screen_pos)

	var direction := camera.project_ray_normal(screen_pos)
	ProjectileManager.fire("kinetic_dart", muzzle.global_position, direction, muzzle_projectile_speed)
	camera.apply_recoil(0.05)
	AudioManager.play_sfx("projectile_fire")
	GameManager.register_shot_fired()

func _on_hazard_entered(_other: Node) -> void:
	VFXManager.request_camera_shake(0.5, 0.3)
	VFXManager.trigger_haptic(1.0)
	AudioManager.play_sfx("obstacle_collision")
	GameManager.trigger_game_over()
