extends Camera3D
class_name CameraController
## CameraController
## Owns all first-person camera "feel": subtle forward-speed bob, shake on
## impact, brief recoil kick on fire, and a small FOV increase as the
## player speeds up. Never changes the logical player position -- only
## adds a decaying local offset on top of the rest position each frame.

@export var base_fov: float = 75.0
@export var max_fov_bonus: float = 8.0
@export var bob_amplitude: float = 0.035
@export var bob_frequency: float = 1.8
@export var max_bank_degrees: float = 4.0
## How far the view leans toward the reticle. Deliberately small: this is
## the view ACKNOWLEDGING the aim, not the aim itself -- the shot goes
## through the reticle regardless. Anything larger and the horizon starts
## swimming on a phone screen.
@export var aim_yaw_degrees: float = 4.0
@export var aim_pitch_degrees: float = 3.0

var _rest_position: Vector3
var _rest_rotation_degrees: Vector3
var _time: float = 0.0
var _bank_degrees: float = 0.0
var _aim_lean: Vector2 = Vector2.ZERO

var _shake_strength: float = 0.0
var _shake_duration: float = 0.0
var _shake_elapsed: float = 0.0

var _recoil_offset: Vector3 = Vector3.ZERO
var _recoil_velocity: Vector3 = Vector3.ZERO

@onready var _player: PlayerController = get_parent()

func _ready() -> void:
	_rest_position = position
	_rest_rotation_degrees = rotation_degrees
	fov = base_fov
	VFXManager.camera_shake_requested.connect(_on_shake_requested)

func _process(delta: float) -> void:
	_time += delta

	var speed_ratio := 0.0
	if _player:
		speed_ratio = clampf(_player.forward_speed / maxf(_player.base_forward_speed * 2.0, 0.001), 0.0, 1.0)

	fov = lerpf(fov, base_fov + max_fov_bonus * speed_ratio, delta * 4.0)

	var bob := Vector3(
		sin(_time * bob_frequency) * bob_amplitude * 0.5,
		abs(sin(_time * bob_frequency * 2.0)) * bob_amplitude,
		0.0
	) * (0.4 + speed_ratio)

	var shake_offset := Vector3.ZERO
	if _shake_elapsed < _shake_duration:
		_shake_elapsed += delta
		var falloff := 1.0 - (_shake_elapsed / _shake_duration)
		shake_offset = Vector3(
			randf_range(-1.0, 1.0),
			randf_range(-1.0, 1.0),
			0.0
		) * _shake_strength * falloff

	_recoil_velocity = _recoil_velocity.lerp(Vector3.ZERO, delta * 12.0)
	_recoil_offset = _recoil_offset.lerp(Vector3.ZERO, delta * 10.0)

	position = _rest_position + bob + shake_offset + _recoil_offset

	# Bank gently into the direction of lateral movement -- a subtle
	# "leaning into the turn" read, not an arcade-racer barrel roll.
	var target_bank := 0.0
	var target_lean := Vector2.ZERO
	if _player:
		target_bank = clampf(-_player.get_lateral_velocity() * 0.6, -max_bank_degrees, max_bank_degrees)
		# Reticle right (+x) -> view turns right, which is NEGATIVE yaw in
		# Godot. Reticle down (+y) -> view pitches down, negative on X.
		var aim := _player.get_aim_norm()
		target_lean = Vector2(-aim.x * aim_yaw_degrees, -aim.y * aim_pitch_degrees)
	_bank_degrees = lerpf(_bank_degrees, target_bank, delta * 5.0)
	_aim_lean = _aim_lean.lerp(target_lean, delta * 7.0)
	rotation_degrees = _rest_rotation_degrees + Vector3(_aim_lean.y, _aim_lean.x, _bank_degrees)

func apply_recoil(strength: float = 0.06) -> void:
	_recoil_offset += Vector3(0, 0, strength)

func _on_shake_requested(strength: float, duration: float) -> void:
	_shake_strength = strength
	_shake_duration = duration
	_shake_elapsed = 0.0
