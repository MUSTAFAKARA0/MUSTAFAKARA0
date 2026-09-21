extends Node
## SaveManager
## 100% local JSON save file. No backend, no accounts. Versioned so the
## save format can be migrated later (see docs/SAVE_SYSTEM.md).

const SAVE_PATH := "user://breakline_save.json"
const SAVE_VERSION := 1

var data: Dictionary = {}

func _ready() -> void:
	load_data()

func _default_data() -> Dictionary:
	return {
		"save_version": SAVE_VERSION,
		"best_score": 0,
		"best_distance": 0.0,
		"best_combo": 0,
		"total_coins": 0,
		"total_runs": 0,
		"unlocked_levels": ["level_01"],
		"unlocked_skins": ["default"],
		"equipped_skin": "default",
		"achievements": [],
		"settings": {},
	}

func load_data() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		data = _default_data()
		save_data()
		return

	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		push_warning("BREAKLINE SaveManager: could not open save file, using defaults.")
		data = _default_data()
		return

	var text := file.get_as_text()
	file.close()

	var parsed = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("BREAKLINE SaveManager: save file corrupted, resetting to defaults.")
		data = _default_data()
		save_data()
		return

	data = _migrate(parsed)
	if data.get("settings", {}).size() > 0:
		SettingsManager.load_from_dict(data["settings"])

func _migrate(loaded: Dictionary) -> Dictionary:
	# loaded.get("save_version", 0) is where a future `if version < 2: ...`
	# transform would branch before the merge below.
	var merged := _default_data()
	for key in loaded.keys():
		merged[key] = loaded[key]
	merged["save_version"] = SAVE_VERSION
	return merged

func save_data() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("BREAKLINE SaveManager: could not write save file.")
		return
	file.store_string(JSON.stringify(data, "\t"))
	file.close()

func save_settings() -> void:
	data["settings"] = SettingsManager.to_dict()
	save_data()

func register_run_result(stats: Dictionary) -> void:
	data["total_runs"] = int(data.get("total_runs", 0)) + 1
	data["best_score"] = max(int(data.get("best_score", 0)), int(stats.get("score", 0)))
	data["best_distance"] = max(float(data.get("best_distance", 0.0)), float(stats.get("distance", 0.0)))
	data["best_combo"] = max(int(data.get("best_combo", 0)), int(stats.get("max_combo", 0)))
	data["total_coins"] = int(data.get("total_coins", 0)) + int(stats.get("coins", 0))
	save_data()

func get_best_score() -> int:
	return int(data.get("best_score", 0))

func get_total_coins() -> int:
	return int(data.get("total_coins", 0))
