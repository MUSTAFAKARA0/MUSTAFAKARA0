extends Area3D
class_name Projectile
## Projectile ("Kinetic Dart")
## Moves in a straight line, checks for target/obstacle overlap each
## physics frame, and returns itself to the ProjectileManager pool when it
## either hits something or exceeds its lifetime. A projectile that
## expires without hitting a target counts as a miss and breaks combo.
##
## Oriented (via look_at) rather than a plain orb -- its fins visibly
## "unfold" open on launch (see _unfold_fins) so the direction it was
## fired reads clearly even in a single frame, not just while moving.

@export var lifetime: float = 2.5
@export var default_speed: float = 40.0

var _direction: Vector3 = Vector3.FORWARD
var _speed: float = 40.0
var _pool_key: String = "kinetic_dart"
var _life_elapsed: float = 0.0
var _has_hit: bool = false

@onready var _trail: CPUParticles3D = $Trail if has_node("Trail") else null
@onready var _body: MeshInstance3D = $Body if has_node("Body") else null
@onready var _fins: Array[MeshInstance3D] = _collect_fins()

func _collect_fins() -> Array[MeshInstance3D]:
	var out: Array[MeshInstance3D] = []
	if not has_node("Fins"):
		return out
	for child in get_node("Fins").get_children():
		var fin := child as MeshInstance3D
		if fin:
			out.append(fin)
	return out

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	monitoring = false

func set_pool_key(key: String) -> void:
	_pool_key = key

func launch(direction: Vector3, speed: float) -> void:
	_direction = direction
	_speed = speed if speed > 0.0 else default_speed
	_life_elapsed = 0.0
	_has_hit = false
	monitoring = true
	look_at(global_position + _direction, Vector3.UP)
	if _trail:
		_trail.emitting = true
	_unfold_fins()

## Fins snap to folded (scale 0 on their outward axis) then spring open
## over ~60ms -- a launch "tell" distinct from the old orb, which had no
## equivalent moment at all.
func _unfold_fins() -> void:
	for fin in _fins:
		fin.scale = Vector3(0.15, 0.15, 1.0)
		var tween := create_tween()
		tween.tween_property(fin, "scale", Vector3.ONE, 0.06).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _physics_process(delta: float) -> void:
	_life_elapsed += delta
	global_position += _direction * _speed * delta

	# Subtle energy-core pulse -- purely cosmetic, keeps the dart from
	# reading as a static prop while it's mid-flight.
	if _body:
		var pulse := 1.0 + sin(_life_elapsed * 18.0) * 0.06
		_body.scale = Vector3(pulse, pulse, 1.0)

	if _life_elapsed >= lifetime:
		_expire(false)

func _on_body_entered(body: Node) -> void:
	_handle_collision(body)

func _on_area_entered(area: Node) -> void:
	_handle_collision(area)

func _handle_collision(other: Node) -> void:
	if _has_hit:
		return

	var target := other as GlassTarget
	if target:
		_has_hit = true
		target.take_hit(global_position, -_direction, _direction)
		GameManager.register_shot_hit()
		_expire(true)

func _expire(hit: bool) -> void:
	monitoring = false
	if _trail:
		_trail.emitting = false
	if not hit:
		ComboManager.break_combo()
	ProjectileManager.return_to_pool(self, _pool_key)

## Called by ProjectileManager.return_all_active() when a run ends/retries.
## Skips the "miss breaks combo" side effect since the run is already over.
func force_return_to_pool() -> void:
	if not visible:
		return
	_expire(true)
