extends Node
## AudioManager
## Central SFX/music playback. Looks audio up by name from assets/audio/
## so gameplay code never references file paths directly. If a clip has
## not been dropped in yet, playback is silently skipped (logged once)
## rather than throwing -- this keeps the vertical slice runnable before
## final audio assets exist (see docs/ASSETS.md).

const SFX_DIR := "res://assets/audio/sfx/"
const MUSIC_DIR := "res://assets/audio/music/"
const SFX_POOL_SIZE := 12

var _sfx_players: Array[AudioStreamPlayer] = []
var _next_player_index: int = 0
var _music_player: AudioStreamPlayer
var _missing_warned: Dictionary = {}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in range(SFX_POOL_SIZE):
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_sfx_players.append(p)

	_music_player = AudioStreamPlayer.new()
	_music_player.bus = "Master"
	add_child(_music_player)

	SettingsManager.settings_changed.connect(_on_settings_changed)

func play_sfx(clip_name: String, volume_scale: float = 1.0) -> void:
	var stream := _load_stream(SFX_DIR, clip_name)
	if stream == null:
		return
	var player := _sfx_players[_next_player_index]
	_next_player_index = (_next_player_index + 1) % _sfx_players.size()
	player.stream = stream
	player.volume_db = linear_to_db(clamp(SettingsManager.sfx_volume * SettingsManager.master_volume * volume_scale, 0.0, 1.0))
	player.play()

func play_music(track_name: String, fade_in: bool = true) -> void:
	var stream := _load_stream(MUSIC_DIR, track_name)
	if stream == null:
		return
	_music_player.stream = stream
	_music_player.volume_db = linear_to_db(clamp(SettingsManager.music_volume * SettingsManager.master_volume, 0.0, 1.0))
	_music_player.play()

func stop_music() -> void:
	_music_player.stop()

func _load_stream(dir: String, clip_name: String) -> AudioStream:
	for ext in ["ogg", "wav", "mp3"]:
		var path := "%s%s.%s" % [dir, clip_name, ext]
		if ResourceLoader.exists(path):
			return load(path)
	if not _missing_warned.has(clip_name):
		_missing_warned[clip_name] = true
		print("[AudioManager] Missing audio asset '%s' in %s -- placeholder silence used." % [clip_name, dir])
	return null

func _on_settings_changed() -> void:
	_music_player.volume_db = linear_to_db(clamp(SettingsManager.music_volume * SettingsManager.master_volume, 0.0, 1.0))
