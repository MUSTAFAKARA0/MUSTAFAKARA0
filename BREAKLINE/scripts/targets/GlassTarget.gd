extends Area3D
class_name GlassTarget
## GlassTarget
## A breakable glass panel. Vertical-slice scope covers NORMAL (score) and
## FAKE (penalty -- breaks combo, no points) types; MOVING targets slide
## side to side. Other core types from docs/GAMEPLAY.md (energy/multi/
## time/gold/shield/combo cores) plug into the same take_hit() contract
## later without touching TargetManager.

enum TargetType { NORMAL, FAKE, MOVING }

signal shattered(target: Node)

@export var target_type: TargetType = TargetType.NORMAL
@export var base_points: int = 100
@export var coin_reward: int = 2
@export var glass_color: Color = Color(0.45, 0.85, 1.0, 0.55)
@export var move_amplitude: float = 1.5
@export var move_speed: float = 1.2

@onready var _mesh: MeshInstance3D = $Mesh
@onready var _collision: CollisionShape3D = $Collision

var _is_shattered: bool = true
var _move_time: float = 0.0
var _base_local_x: float = 0.0

func _ready() -> void:
	add_to_group("target")
	monitorable = false
	monitoring = false

func configure(type: TargetType, points: int, color: Color) -> void:
	target_type = type
	base_points = points
	glass_color = color
	_apply_visuals()

func _apply_visuals() -> void:
	if not _mesh:
		return
	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = glass_color if target_type != TargetType.FAKE else Color(1.0, 0.35, 0.35, 0.55)
	mat.emission_enabled = true
	mat.emission = mat.albedo_color
	mat.emission_energy_multiplier = 1.2
	_mesh.material_override = mat

func spawn_reset(local_position: Vector3) -> void:
	position = local_position
	_base_local_x = local_position.x
	_move_time = 0.0
	_is_shattered = false
	visible = true
	monitorable = true
	if _collision:
		_collision.disabled = false
	_apply_visuals()

func _process(delta: float) -> void:
	if _is_shattered or target_type != TargetType.MOVING:
		return
	_move_time += delta
	position.x = _base_local_x + sin(_move_time * move_speed) * move_amplitude

func take_hit(hit_position: Vector3, hit_normal: Vector3) -> void:
	if _is_shattered:
		return
	_is_shattered = true
	monitorable = false
	visible = false
	if _collision:
		_collision.disabled = true

	FragmentManager.shatter_at(hit_position, glass_color, hit_normal)
	VFXManager.spawn_burst(hit_position, glass_color)
	VFXManager.request_camera_shake(0.18, 0.1)
	VFXManager.trigger_haptic(0.5)
	AudioManager.play_sfx("glass_shatter")

	if target_type == TargetType.FAKE:
		AudioManager.play_sfx("combo_break")
		ComboManager.break_combo()
	else:
		ComboManager.register_hit()
		ScoreManager.add_target_hit(base_points)
		GameManager.add_coins(coin_reward)
		AudioManager.play_sfx("target_hit")

	shattered.emit(self)
