extends Node3D
class_name PlayerController
## PlayerController
## Drives the endless-runner half of gameplay: forward motion, lateral
## repositioning, and wiring InputManager's tap/drag signals into aiming
## and firing. The player is never a visible 3D model -- everything is
## felt through the camera (see CameraController.gd).
##
## CONTROL MODEL (docs/GAMEPLAY.md)
##   DRAG  -> aim. Moves the reticle and leans the camera.
##   DRAG past a deadzone -> ALSO leans the player sideways, slowly.
##   TAP   -> fire a Kinetic Dart at the reticle.
##
## The deadzone is the whole point. Aiming anywhere in the middle ~70% of
## the screen moves the player NOT AT ALL, so the shot and the dodge are
## separate actions that happen to share one finger. The previous version
## mapped absolute reticle position straight onto world X, which meant
## aiming right and flying right were literally the same variable -- and
## produced a measured 19.2 m/s lateral snap (1.6x the forward speed) from
## a single touch. PRECISION > FREEDOM.

## ---- forward motion -------------------------------------------------
@export var base_forward_speed: float = 12.0
@export var max_forward_speed: float = 26.0
@export var speed_ramp_per_second: float = 0.15

## ---- lateral motion -------------------------------------------------
## Half-width of the space the player may occupy. Lanes sit at +/-2.2, so
## this leaves a little room to overshoot a lane without leaving the
## corridor.
@export var lane_half_width: float = 3.2
## Hard ceiling on sideways speed. Nothing may exceed this -- not a flick,
## not a corner case, not a frame spike.
@export var max_lateral_speed: float = 3.2
## Asymmetric on purpose: stopping is quicker than starting. That is what
## makes small corrections land where the player aimed them instead of
## drifting past.
@export var lateral_acceleration: float = 9.0
@export var lateral_deceleration: float = 14.0
## Fraction of half-screen within which aiming does not steer at all.
@export var steer_deadzone: float = 0.35
## Distance from the wall over which steering authority fades to zero, so
## the corridor edge absorbs the player instead of stopping them dead.
@export var edge_softening: float = 0.6

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
var _lateral_velocity: float = 0.0

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
	_advance_lateral(delta)

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

func _advance_lateral(delta: float) -> void:
	var desired := _steer_input() * max_lateral_speed

	# Accelerate only when pushing further in the direction already
	# travelling; anything else (releasing, reversing) decelerates.
	var rate := lateral_deceleration
	var pushing_onward := not is_zero_approx(desired) and (
		is_zero_approx(_lateral_velocity) or signf(desired) == signf(_lateral_velocity)
	)
	if pushing_onward:
		rate = lateral_acceleration
	_lateral_velocity = move_toward(_lateral_velocity, desired, rate * delta)

	# Soft edge: authority fades across the last `edge_softening` metres,
	# but only against the wall being approached.
	var overshoot := absf(global_position.x) - (lane_half_width - edge_softening)
	if overshoot > 0.0 and signf(_lateral_velocity) == signf(global_position.x):
		_lateral_velocity *= clampf(1.0 - overshoot / edge_softening, 0.0, 1.0)

	global_position.x = clampf(
		global_position.x + _lateral_velocity * delta,
		-lane_half_width,
		lane_half_width
	)

## Deadzoned, squared steering response.
##
## Squared rather than linear so the first third past the deadzone barely
## moves at all: that band is where small aiming corrections live, and they
## must not cost lateral position. Full speed is only available at the very
## edge of the screen, which reads as a deliberate commitment.
func _steer_input() -> float:
	var raw := clampf(_aim_norm.x, -1.0, 1.0)
	var magnitude := absf(raw)
	if magnitude <= steer_deadzone:
		return 0.0
	var t := (magnitude - steer_deadzone) / (1.0 - steer_deadzone)
	return signf(raw) * t * t

## Read by CameraController for the lean-into-the-turn bank. Never used to
## move the player -- this is the RESULT of steering, not its input.
func get_lateral_velocity() -> float:
	return _lateral_velocity

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
