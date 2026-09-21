extends Node
## InputManager
## Single source of truth for touch input. Converts raw touch/mouse events
## into gameplay-level signals so PlayerController / CameraController never
## touch InputEvent directly. Works with both touchscreen and mouse
## (mouse is treated as a single finger for editor testing).

signal aim_touch_started(screen_pos: Vector2)
signal aim_touch_moved(screen_pos: Vector2, delta: Vector2)
signal aim_touch_ended(screen_pos: Vector2)
signal shoot_requested(screen_pos: Vector2)

## Drag distance (px) below which a touch is treated as a tap/shoot
## rather than an aim drag.
const TAP_MAX_DRAG := 24.0
## Drag distance (px) beyond which a touch definitely counts as an aim drag.
const TAP_MAX_DURATION := 0.35

var _active_pointer_id: int = -1
var _press_position: Vector2 = Vector2.ZERO
var _last_position: Vector2 = Vector2.ZERO
var _press_time: float = 0.0
var _has_dragged: bool = false

var input_enabled: bool = true

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS

func set_input_enabled(enabled: bool) -> void:
	input_enabled = enabled
	if not enabled:
		_active_pointer_id = -1

func _unhandled_input(event) -> void:
	if not input_enabled:
		return

	if event is InputEventScreenTouch:
		if event.pressed:
			_begin_pointer(event.index, event.position)
		else:
			_end_pointer(event.index, event.position)
	elif event is InputEventScreenDrag:
		_move_pointer(event.index, event.position, event.relative)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_begin_pointer(0, event.position)
		else:
			_end_pointer(0, event.position)
	elif event is InputEventMouseMotion:
		if _active_pointer_id == 0:
			_move_pointer(0, event.position, event.relative)

func _begin_pointer(id: int, pos: Vector2) -> void:
	if _active_pointer_id != -1:
		return
	_active_pointer_id = id
	_press_position = pos
	_last_position = pos
	_press_time = Time.get_ticks_msec() / 1000.0
	_has_dragged = false
	aim_touch_started.emit(pos)

func _move_pointer(id: int, pos: Vector2, relative: Vector2) -> void:
	if id != _active_pointer_id:
		return
	if pos.distance_to(_press_position) > TAP_MAX_DRAG:
		_has_dragged = true
	_last_position = pos
	aim_touch_moved.emit(pos, relative)

func _end_pointer(id: int, pos: Vector2) -> void:
	if id != _active_pointer_id:
		return
	var duration := Time.get_ticks_msec() / 1000.0 - _press_time
	var drag_distance := pos.distance_to(_press_position)
	_active_pointer_id = -1
	aim_touch_ended.emit(pos)

	if not _has_dragged and drag_distance <= TAP_MAX_DRAG and duration <= TAP_MAX_DURATION:
		shoot_requested.emit(pos)
