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
@onready var _core_band: MeshInstance3D = $CoreBand if has_node("CoreBand") else null
@onready var _fins_root: Node3D = $Fins if has_node("Fins") else null

var _fin_tween: Tween

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

## Fins snap tucked against the body then spring open over ~70ms -- a
## launch "tell" the old orb had no equivalent of. Scaling the Fins PARENT
## pulls the fins inward AND shortens them in one property, so this is a
## single tween per shot instead of one per fin, and the fold reads as the
## fins retracting into the shell rather than four blades shrinking in
## place. Roll is reset here so every dart starts from the same clean
## cross before _spin_fins takes over.
func _unfold_fins() -> void:
	if _fins_root == null:
		return
	if _fin_tween and _fin_tween.is_valid():
		_fin_tween.kill()
	_fins_root.rotation.z = 0.0
	_fins_root.scale = Vector3(0.22, 0.22, 1.0)
	_fin_tween = create_tween()
	_fin_tween.tween_property(_fins_root, "scale", Vector3.ONE, 0.07) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _physics_process(delta: float) -> void:
	_life_elapsed += delta
	global_position += _direction * _speed * delta

	# Two mid-flight tells, both on the lit parts only so the dark shell's
	# silhouette stays constant:
	#   - the energy band breathes in radius (NOT along the dart's length --
	#     the band mesh is rotated -90 on X, so its local Y is the length
	#     axis and must stay at 1.0),
	#   - the fin cross rolls slowly, which reads as spin stabilisation and
	#     makes the four-blade shape unmistakable in flight.
	if _core_band:
		var pulse := 1.0 + sin(_life_elapsed * 16.0) * 0.07
		_core_band.scale = Vector3(pulse, 1.0, pulse)
	if _fins_root:
		_fins_root.rotation.z += delta * 5.5

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
		return

	# A MECHANICAL obstacle is matter, so the dart stops on it. This is what
	# makes a blast door worth routing around instead of shooting through:
	# the shard behind it cannot be hit until the player has the angle.
	# ENERGY obstacles are not on the solid layer at all, so they never
	# reach this branch -- a dart passes through a containment field.
	var obstacle := other as Obstacle
	if obstacle:
		_has_hit = true
		VFXManager.spawn_impact_flash(global_position, Color(1.0, 0.55, 0.2), 1.4, 0.1)
		VFXManager.spawn_burst(global_position, Color(1.0, 0.6, 0.25), 10)
		AudioManager.play_sfx("glass_crack", 0.5)
		# Still a miss: it cost a shot and hit nothing scoreable.
		_expire(false)

func _expire(hit: bool) -> void:
	monitoring = false
	if _trail:
		_trail.emitting = false
	# Must not outlive the shot: a pooled dart re-launched mid-tween would
	# otherwise unfold from a half-finished scale.
	if _fin_tween and _fin_tween.is_valid():
		_fin_tween.kill()
	_fin_tween = null
	if not hit:
		ComboManager.break_combo()
	ProjectileManager.return_to_pool(self, _pool_key)

## Called by ProjectileManager.return_all_active() when a run ends/retries.
## Skips the "miss breaks combo" side effect since the run is already over.
func force_return_to_pool() -> void:
	if not visible:
		return
	_expire(true)
