INSERT INTO rooms (id, slug, name, display_order)
VALUES
  ('drawing', 'drawing', 'Drawing Room', 1),
  ('work1', 'work1', 'Work Room 1', 2),
  ('work2', 'work2', 'Work Room 2', 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  updated_at = now();

INSERT INTO devices (id, room_id, type, label, rated_watts, hardware_channel)
VALUES
  ('drawing-fan-1', 'drawing', 'fan', 'Fan 1', 60, 'drawing:fan:1'),
  ('drawing-fan-2', 'drawing', 'fan', 'Fan 2', 60, 'drawing:fan:2'),
  ('drawing-light-1', 'drawing', 'light', 'Light 1', 15, 'drawing:light:1'),
  ('drawing-light-2', 'drawing', 'light', 'Light 2', 15, 'drawing:light:2'),
  ('drawing-light-3', 'drawing', 'light', 'Light 3', 15, 'drawing:light:3'),
  ('work1-fan-1', 'work1', 'fan', 'Fan 1', 60, 'work1:fan:1'),
  ('work1-fan-2', 'work1', 'fan', 'Fan 2', 60, 'work1:fan:2'),
  ('work1-light-1', 'work1', 'light', 'Light 1', 15, 'work1:light:1'),
  ('work1-light-2', 'work1', 'light', 'Light 2', 15, 'work1:light:2'),
  ('work1-light-3', 'work1', 'light', 'Light 3', 15, 'work1:light:3'),
  ('work2-fan-1', 'work2', 'fan', 'Fan 1', 60, 'work2:fan:1'),
  ('work2-fan-2', 'work2', 'fan', 'Fan 2', 60, 'work2:fan:2'),
  ('work2-light-1', 'work2', 'light', 'Light 1', 15, 'work2:light:1'),
  ('work2-light-2', 'work2', 'light', 'Light 2', 15, 'work2:light:2'),
  ('work2-light-3', 'work2', 'light', 'Light 3', 15, 'work2:light:3')
ON CONFLICT (id) DO UPDATE SET
  room_id = EXCLUDED.room_id,
  type = EXCLUDED.type,
  label = EXCLUDED.label,
  rated_watts = EXCLUDED.rated_watts,
  hardware_channel = EXCLUDED.hardware_channel,
  updated_at = now();
