extends TargetBehavior
class_name NormalTargetBehavior
## Stationary, scores on hit. The baseline every other behavior deviates from.

func on_hit(_target: GlassTarget) -> bool:
	return true

func get_id() -> String:
	return "normal"
