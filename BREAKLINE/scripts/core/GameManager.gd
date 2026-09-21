extends Node
## GameManager
## Central state machine for BREAKLINE. Autoload singleton.
## Owns the current run's stats and drives scene transitions between
## Main Menu <-> Level. Individual gameplay systems (score, combo, save)
## stay in their own managers; this node only orchestrates state.

enum State { MENU, PLAYING, PAUSED, GAME_OVER }

signal state_changed(new_state: State)
signal run_started
signal run_ended(stats: Dictionary)

const MAIN_MENU_SCENE := "res://scenes/ui/MainMenu.tscn"
const LEVEL_01_SCENE := "res://scenes/levels/Level01.tscn"

var current_state: State = State.MENU

var shots_fired: int = 0
var shots_hit: int = 0
var distance_traveled: float = 0.0
var coins_earned: int = 0
var current_level_path: String = LEVEL_01_SCENE

var _fade_layer: CanvasLayer
var _fade_rect: ColorRect

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build_fade_overlay()

func _build_fade_overlay() -> void:
	_fade_layer = CanvasLayer.new()
	_fade_layer.layer = 100
	add_child(_fade_layer)

	_fade_rect = ColorRect.new()
	_fade_rect.color = Color(0.0, 0.0, 0.0, 0.0)
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fade_layer.add_child(_fade_rect)

## Fades the screen to/from black. While faded in (alpha > 0) the overlay
## also blocks touch/mouse input, so it doubles as a scene-transition guard
## against taps landing on whatever is loading underneath.
func _fade_to(alpha: float, duration: float) -> void:
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_STOP if alpha > 0.0 else Control.MOUSE_FILTER_IGNORE
	var tween := create_tween()
	tween.tween_property(_fade_rect, "color:a", alpha, duration)
	await tween.finished

func start_run() -> void:
	shots_fired = 0
	shots_hit = 0
	distance_traveled = 0.0
	coins_earned = 0
	ScoreManager.reset()
	ComboManager.reset()
	InputManager.set_input_enabled(true)
	_set_state(State.PLAYING)
	run_started.emit()

func register_shot_fired() -> void:
	shots_fired += 1

func register_shot_hit() -> void:
	shots_hit += 1

func add_coins(amount: int) -> void:
	coins_earned += amount

func get_accuracy() -> float:
	if shots_fired <= 0:
		return 0.0
	return float(shots_hit) / float(shots_fired) * 100.0

func trigger_game_over() -> void:
	if current_state != State.PLAYING:
		return
	_set_state(State.GAME_OVER)
	# Locks out touch input immediately: without this, a finger already
	# mid-drag when the run ends can leave InputManager's pointer-tracking
	# stuck (see InputManager._active_pointer_id), silently eating the next
	# tap after Retry even though the Game Over panel's Dim rect also
	# blocks GUI input on top of it.
	InputManager.set_input_enabled(false)
	AudioManager.play_sfx("game_over")

	# Projectile._physics_process() has no PLAYING-state guard (it only
	# checks its own lifetime), so a projectile still mid-flight at the
	# instant of death would otherwise keep flying behind the Game Over
	# panel and could still register a target hit -- mutating score/combo
	# after the stats snapshot below has already been taken and shown.
	# Fragments are left alone: they're purely cosmetic and can't mutate
	# game state, so letting them keep settling during the reveal is fine.
	ProjectileManager.return_all_active()

	var stats := {
		"score": ScoreManager.score,
		"best_score": max(ScoreManager.score, SaveManager.data.get("best_score", 0)),
		"distance": distance_traveled,
		"accuracy": get_accuracy(),
		"max_combo": ComboManager.max_combo,
		"coins": coins_earned,
	}

	SaveManager.register_run_result(stats)
	run_ended.emit(stats)

## Reloading/loading the level scene triggers that scene's own _ready(),
## which is responsible for calling start_run() once it has set itself up
## (see LevelManager.gd). GameManager only handles the transition itself.
##
## ProjectileManager/FragmentManager are autoloads, so their pooled
## children (in-flight projectiles, still-falling glass shards) otherwise
## survive reload_current_scene() and keep animating, disconnected, in the
## freshly-reloaded level -- return_all_active() clears that before we
## reload.
func retry() -> void:
	await _fade_to(1.0, 0.25)
	ProjectileManager.return_all_active()
	FragmentManager.return_all_active()
	get_tree().paused = false
	get_tree().reload_current_scene()
	await get_tree().process_frame
	await _fade_to(0.0, 0.25)

func go_to_main_menu() -> void:
	await _fade_to(1.0, 0.25)
	InputManager.set_input_enabled(false)
	ProjectileManager.return_all_active()
	FragmentManager.return_all_active()
	get_tree().paused = false
	_set_state(State.MENU)
	get_tree().change_scene_to_file(MAIN_MENU_SCENE)
	await get_tree().process_frame
	await _fade_to(0.0, 0.25)

func go_to_level(level_path: String = "") -> void:
	await _fade_to(1.0, 0.25)
	if level_path != "":
		current_level_path = level_path
	get_tree().change_scene_to_file(current_level_path)
	await get_tree().process_frame
	await _fade_to(0.0, 0.25)

func set_paused(paused: bool) -> void:
	if current_state != State.PLAYING and paused:
		return
	get_tree().paused = paused
	_set_state(State.PAUSED if paused else State.PLAYING)

func _set_state(new_state: State) -> void:
	current_state = new_state
	state_changed.emit(new_state)
