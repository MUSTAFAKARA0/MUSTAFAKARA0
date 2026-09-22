extends Resource
class_name LevelData
## LevelData
## Data-driven level definition (see docs/LEVELS.md). LevelManager reads
## one of these on _ready() and pushes the values into the player and the
## spawner nodes, rather than any gameplay system hardcoding numbers.

@export var level_id: String = "level_01"
@export var display_name: String = "Glass District"

@export_group("Movement")
@export var base_forward_speed: float = 12.0
@export var max_forward_speed: float = 26.0
@export var speed_ramp_per_second: float = 0.15

@export_group("Difficulty")
## Distance (meters) over which difficulty ramps from 0 to 1.
@export var difficulty_ramp_distance: float = 800.0

@export_group("Presentation")
@export var music_track: String = "glass_district_theme"
