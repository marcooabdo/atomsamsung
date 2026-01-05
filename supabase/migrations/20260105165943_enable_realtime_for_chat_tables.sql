/*
  # Enable Realtime for Chat Tables
  
  1. Problem
    - Chat tables are not enabled for realtime updates
    - Messages don't appear in real-time
  
  2. Solution
    - Add chat tables to the supabase_realtime publication
*/

ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reads;
