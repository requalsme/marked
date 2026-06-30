# Asset Index

QA status: PASS

Important previews:
- previews/keeping_house_2_5d_room_mockup.png
- previews/characters_enemies_preview.png
- previews/props_environment_preview.png
- previews/animation_order_review.png

Manifest files:
- pack_manifest.json
- manifest.csv
- FINAL_QA_REPORT.md

Runtime notes:
- Use bottom-center origin for world sprites.
- Use `mirror_x` for player/enemy/boss left-right facing.
- Use `depth_sort_offset` with Y sorting for 2.5D ordering.
- Combat hit windows are listed in each attack animation JSON.