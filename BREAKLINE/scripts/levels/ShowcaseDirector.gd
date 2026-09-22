extends LevelManager
class_name ShowcaseDirector
## ShowcaseDirector
## Root script for ShowcaseSection.tscn -- the VISUAL QUALITY GATE
## section. It is a real, playable run of the real game: same
## PlayerController, same pooled TargetManager/ObstacleManager, same
## materials, same destruction. The ONLY difference is that the seven
## gameplay elements are placed by hand instead of by the RNG spawner
## (both managers run with auto_spawn = false), and the level data is
## tuned slow enough that a Containment Shard's facets, rim and core can
## actually be read as it approaches.
##
## This is NOT the authored level system. It has no pacing model, no
## section vocabulary, no difficulty contract -- it is one hardcoded list
## whose only job is to put each visual element in front of the camera
## once, with space around it. The authored level system replaces this
## list wholesale; the spawn_target()/spawn_obstacle() API it uses is the
## part meant to survive.
##
## Deliberately NOT here: multiple elements competing in one frame, decor
## added "to fill space", or any element repeated for density. A cluttered
## showcase cannot answer the question it exists to ask.

## One beat of the showcase: z metres down the track, which lane, and what
## to put there. Kept as plain data so the layout reads as a layout.
const LAYOUT := [
	# 1. THE SHARD, alone and dead centre. First read: silhouette, facet
	#    translucency, core visible through the facets.
	{"kind": "target", "z": -22.0, "x": 0.0, "behavior": "normal", "material": "glass"},
	# 2. Same shard off-lane, so it is read against the dense left wall
	#    rather than against empty fog.
	{"kind": "target", "z": -40.0, "x": -2.2, "behavior": "normal", "material": "glass"},
	# 3. MOVING. Motion tell, still on a clean background.
	{"kind": "target", "z": -56.0, "x": 2.2, "behavior": "moving", "material": "glass"},
	# 4. The A/B pair. Fake (Unstable Signal) on the left, real on the
	#    right, same distance, same frame -- the only place in the section
	#    where two targets share a beat, because comparison IS the beat.
	{"kind": "target", "z": -74.0, "x": -2.2, "behavior": "fake", "material": "signal"},
	{"kind": "target", "z": -74.0, "x": 2.2, "behavior": "normal", "material": "glass"},
	# 5. DANGER. The warm hazard material, alone, so the colour contract
	#    (warm = ends your run) is unambiguous.
	{"kind": "obstacle", "z": -92.0, "x": 0.0},
	# 6. A shard immediately after the hazard: does the cyan gameplay read
	#    survive right after the eye has been on orange?
	{"kind": "target", "z": -108.0, "x": 2.2, "behavior": "normal", "material": "glass"},
	# 7. Last look -- moving, centre, in the stretch where the environment
	#    is at its deepest.
	{"kind": "target", "z": -126.0, "x": 0.0, "behavior": "moving", "material": "glass"},
]

func _ready() -> void:
	super._ready()
	_place_showcase()

func _place_showcase() -> void:
	for entry in LAYOUT:
		var beat: Dictionary = entry
		var kind := String(beat.get("kind", "target"))
		var z := float(beat.get("z", 0.0))
		var x := float(beat.get("x", 0.0))
		if kind == "obstacle":
			obstacle_manager.spawn_obstacle(x, z)
		else:
			target_manager.spawn_target(
				x,
				z,
				String(beat.get("behavior", "normal")),
				String(beat.get("material", "glass"))
			)
