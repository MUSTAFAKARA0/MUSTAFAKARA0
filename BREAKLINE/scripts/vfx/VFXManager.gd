extends Node
## VFXManager
## Pooled particle bursts, camera shake requests and haptics. Kept
## independent of any specific scene so targets/obstacles/projectiles can
## all ask for feedback without knowing about the camera or each other.

signal camera_shake_requested(strength: float, duration: float)
signal hit_flash_requested(world_position: Vector3)

const POOL_SIZE := 16
const FLASH_POOL_SIZE := 6

var _pool: Array[CPUParticles3D] = []
var _pool_index: int = 0

var _flash_pool: Array[OmniLight3D] = []
var _flash_pool_index: int = 0

func _ready() -> void:
	for i in range(POOL_SIZE):
		var particles := _build_particle_node()
		add_child(particles)
		_pool.append(particles)

	for i in range(FLASH_POOL_SIZE):
		var light := _build_flash_light()
		add_child(light)
		_flash_pool.append(light)

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
	light.light_energy = energy

	var tween := create_tween()
	tween.tween_property(light, "light_energy", 0.0, duration)

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

func trigger_haptic(strength: float = 0.5) -> void:
	if not SettingsManager.haptics_enabled:
		return
	if OS.get_name() != "Android":
		return
	Input.vibrate_handheld(int(clamp(strength, 0.0, 1.0) * 60))
