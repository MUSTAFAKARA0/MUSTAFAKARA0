extends TargetBehavior
class_name FakeTargetBehavior
## A decoy: shatters like any other target but breaks combo and scores
## nothing. Told apart from a normal target by three independent signals
## (never color alone): the Unstable Signal material's warning-red palette,
## an irregular jittered facet silhouette (GlassTarget.spawn_reset), and a
## flickering core (this behavior's on_process) -- a real target's core
## glows steady.

func on_process(target: GlassTarget, delta: float) -> void:
	target.update_flicker(delta)

func on_hit(_target: GlassTarget) -> bool:
	return false

func get_id() -> String:
	return "fake"
