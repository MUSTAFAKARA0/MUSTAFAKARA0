extends TargetBehavior
class_name MovingTargetBehavior
## Drifts side to side. Uses two summed sine waves at different frequency/
## phase (both driven by the target's own randomized move_speed/phase, set
## per-spawn in GlassTarget.spawn_reset) instead of one bare sine, so the
## motion reads as an organic drift rather than a metronome.

func on_process(target: GlassTarget, delta: float) -> void:
	target.advance_moving_motion(delta)

func on_hit(_target: GlassTarget) -> bool:
	return true

func get_id() -> String:
	return "moving"
