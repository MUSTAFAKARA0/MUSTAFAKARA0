extends RefCounted
class_name TargetBehavior
## TargetBehavior
## Strategy object for "what KIND of target is this" -- deliberately
## separate from MaterialProfile ("what SUBSTANCE it's made of"). A
## GlassTarget holds exactly one behavior + one material; a new target
## archetype (armored, timed, shielded, ...) is a new behavior subclass
## that TargetManager can hand out without ever touching GlassTarget's
## fracture/VFX/audio pipeline. See docs/TARGETS.md.
##
## Behaviors are stateless and shared: TargetManager keeps exactly one
## instance of each and hands the same reference to every pooled target
## that needs it, so adding a target archetype costs one small object,
## not one per pooled instance.

## Called every frame while the target is alive (not yet shattered).
func on_process(_target: GlassTarget, _delta: float) -> void:
	pass

## Called once when the target is hit, before shatter VFX/audio fire.
## Return true to award score/combo, false for a penalty type (e.g. a
## fake target) that still visually shatters but breaks combo instead.
func on_hit(_target: GlassTarget) -> bool:
	return true

func get_id() -> String:
	return "base"
