extends Node
## SettingsManager
## Holds runtime-adjustable settings (audio, haptics, sensitivity).
## Persisted via SaveManager. Kept separate from SaveManager so gameplay
## code can read settings without depending on the save file format.

signal settings_changed

var master_volume: float = 1.0
var music_volume: float = 0.8
var sfx_volume: float = 1.0
var haptics_enabled: bool = true
var aim_sensitivity: float = 1.0
var target_fps: int = 60

func _ready() -> void:
	apply_fps()

func load_from_dict(dict: Dictionary) -> void:
	master_volume = dict.get("master_volume", master_volume)
	music_volume = dict.get("music_volume", music_volume)
	sfx_volume = dict.get("sfx_volume", sfx_volume)
	haptics_enabled = dict.get("haptics_enabled", haptics_enabled)
	aim_sensitivity = dict.get("aim_sensitivity", aim_sensitivity)
	target_fps = dict.get("target_fps", target_fps)
	apply_fps()
	settings_changed.emit()

func to_dict() -> Dictionary:
	return {
		"master_volume": master_volume,
		"music_volume": music_volume,
		"sfx_volume": sfx_volume,
		"haptics_enabled": haptics_enabled,
		"aim_sensitivity": aim_sensitivity,
		"target_fps": target_fps,
	}

func apply_fps() -> void:
	Engine.max_fps = target_fps

func set_haptics_enabled(enabled: bool) -> void:
	haptics_enabled = enabled
	SaveManager.save_settings()
