extends Resource
class_name MaterialProfile
## MaterialProfile
## Data-only definition of what a destructible object is made of: how it
## looks, how it breaks, and how it responds. GlassTarget/GlassFragment
## read one of these rather than hardcoding "glass" behavior in script --
## a new substance (Metal, EnergyCrystal, Shield, ...) is a new .tres
## resource under data/materials/, never a new script. See docs/MATERIALS.md.
##
## Deliberately flat data, no virtual methods: every material follows the
## exact same fracture pipeline (see FragmentManager.shatter_at) with
## different numbers, which is enough variety without needing a
## per-material behavior class.

@export var material_id: String = "glass"
@export var display_name: String = "Containment Glass"

@export_group("Appearance")
@export var albedo_color: Color = Color(0.45, 0.85, 1.0, 0.55)
@export var emission_color: Color = Color(0.45, 0.85, 1.0)
@export var emission_energy: float = 1.2
@export var core_color: Color = Color(0.75, 0.97, 1.0)
@export var core_emission_energy: float = 3.0

@export_group("Fracture")
## How many pooled shards a shatter requests (FragmentManager may hand
## back fewer if its pool is exhausted -- see docs/PERFORMANCE.md).
@export var fragment_count: int = 8
## Seconds a shard spends flying outward before the inward pull begins.
@export var fragment_outward_time: float = 0.16
## Seconds spent pulling back toward the impact point + fading out.
@export var fragment_dissolve_time: float = 0.32
@export var fragment_gravity_scale: float = 0.4
## Multiplies the outward impulse computed from hit normal / projectile
## direction -- see FragmentManager.shatter_at for the actual formula.
@export var impulse_strength: float = 3.0
@export var impulse_random_spread: float = 1.2

@export_group("Response")
@export var score_multiplier: float = 1.0
@export var sfx_crack: String = "glass_crack"
@export var sfx_shatter: String = "glass_shatter"
@export var camera_shake_strength: float = 0.18
@export var camera_shake_duration: float = 0.1
@export var haptic_strength: float = 0.5
