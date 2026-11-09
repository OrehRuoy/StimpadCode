extends SceneTree

const INTERVAL := 60.0 * 60.0 * 24.0 * 90.0


func _init() -> void:
	var failed := 0
	var review := root.get_node("EnjoyPromptService")
	failed += _expect("playing blocks", "audio", review.automatic_review_block_reason(
		true, false, false, false, 3, true, 1000.0, 0.0, 3, INTERVAL
	))
	failed += _expect("ad blocks", "ad", review.automatic_review_block_reason(
		false, false, true, false, 3, true, 1000.0, 0.0, 3, INTERVAL
	))
	failed += _expect("90 days", "cooldown", review.automatic_review_block_reason(
		false, false, false, false, 5, false, 1000.0, 1000.0, 3, INTERVAL
	))
	failed += _expect("too soon", "too_soon", review.automatic_review_block_reason(
		false, false, false, false, 2, false, 1000.0, 0.0, 3, INTERVAL
	))
	failed += _expect("third session", "", review.automatic_review_block_reason(
		false, false, false, false, 3, false, 1000.0, 0.0, 3, INTERVAL
	))
	failed += _expect("timer before third", "", review.automatic_review_block_reason(
		false, false, false, false, 1, true, 1000.0, 0.0, 3, INTERVAL
	))
	var later := 1000.0 + INTERVAL
	failed += _expect("after 90 days", "", review.automatic_review_block_reason(
		false, false, false, false, 4, false, later, 1000.0, 3, INTERVAL
	))
	if failed > 0:
		push_error("review policy check failed: %d" % failed)
		quit(1)
		return
	print("review policy check ok")
	quit(0)


func _expect(label: String, want: String, got: String) -> int:
	if got == want:
		return 0
	push_error("%s: want '%s' got '%s'" % [label, want, got])
	return 1
