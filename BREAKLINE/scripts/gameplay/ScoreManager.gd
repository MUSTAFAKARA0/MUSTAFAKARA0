extends Node
## ScoreManager
## Owns the current run's score. Reads the active combo multiplier from
## ComboManager but does not manage the combo itself.

signal score_changed(new_score: int, delta: int)

const PERFECT_HIT_BONUS := 25
const DISTANCE_BONUS_PER_METER := 1

var score: int = 0

func reset() -> void:
	score = 0
	score_changed.emit(score, 0)

func add_target_hit(base_points: int, perfect: bool = false) -> int:
	var multiplier := ComboManager.get_multiplier()
	var delta := base_points * multiplier
	if perfect:
		delta += PERFECT_HIT_BONUS
	score += delta
	score_changed.emit(score, delta)
	return delta

func add_distance_bonus(meters: float) -> void:
	var delta := int(meters) * DISTANCE_BONUS_PER_METER
	if delta <= 0:
		return
	score += delta
	score_changed.emit(score, delta)
