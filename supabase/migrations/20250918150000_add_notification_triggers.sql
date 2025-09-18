-- Add notification triggers for real-time updates
-- This will send push notifications instead of requiring polling

-- Function to notify on space changes
CREATE OR REPLACE FUNCTION notify_space_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Send notification with space ID and change type
  PERFORM pg_notify(
    'space_changes',
    json_build_object(
      'operation', TG_OP,
      'space_id', COALESCE(NEW.id, OLD.id),
      'timestamp', extract(epoch from now())
    )::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for INSERT, UPDATE, DELETE on spaces table
DROP TRIGGER IF EXISTS spaces_change_notify ON spaces;
CREATE TRIGGER spaces_change_notify
  AFTER INSERT OR UPDATE OR DELETE ON spaces
  FOR EACH ROW
  EXECUTE FUNCTION notify_space_changes();

-- Add a comment explaining the notification system
COMMENT ON FUNCTION notify_space_changes() IS 'Sends pg_notify on space changes for real-time WebSocket updates';
COMMENT ON TRIGGER spaces_change_notify ON spaces IS 'Triggers push notifications to WebSocket clients on space changes';