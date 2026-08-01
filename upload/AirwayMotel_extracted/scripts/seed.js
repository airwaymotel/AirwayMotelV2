import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const roomsToInsert = [
  { room_number: '1', type: '1-bed', status: 'available', floor: 1 },
  { room_number: '2', type: '1-bed', status: 'available', floor: 1 },
  { room_number: '3', type: '2-bed', status: 'available', floor: 1 },
  { room_number: '4', type: '1-bed', status: 'maintenance', floor: 1 },
  { room_number: '5', type: '2-bed', status: 'available', floor: 1 },
  { room_number: '6', type: '1-bed', status: 'available', floor: 1 },
  { room_number: '7', type: '2-bed', status: 'cleaning', floor: 1 },
  { room_number: '8', type: '1-bed', status: 'available', floor: 1 },
  { room_number: '9', type: '1-bed', status: 'available', floor: 2 },
  { room_number: '10', type: '2-bed', status: 'available', floor: 2 },
  { room_number: '11', type: '1-bed', status: 'reserved', floor: 2 },
  { room_number: '12', type: '2-bed', status: 'available', floor: 2 },
  { room_number: '13', type: '1-bed', status: 'available', floor: 2 },
  { room_number: '14', type: '1-bed', status: 'available', floor: 2 },
  { room_number: '15', type: '2-bed', status: 'available', floor: 2 },
  { room_number: '16', type: '1-bed', status: 'available', floor: 2 },
];

async function seed() {
  console.log("Seeding Rooms...");
  
  // Clear existing rooms
  await supabase.from('rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .insert(roomsToInsert)
    .select();

  if (roomsError) {
    console.error("Error inserting rooms:", roomsError);
    return;
  }
  
  console.log(`Inserted ${rooms.length} rooms.`);

  console.log("Seeding dummy guest and stay...");
  
  // Insert a dummy guest
  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .insert([{
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '1985-05-20',
      id_number: 'CO-55-123-999',
      id_type: 'State ID',
      id_state: 'Colorado',
      address: '123 Fake St',
      city: 'Denver',
      state: 'CO',
      zip: '80205',
      phone: '(303) 555-0199',
      sex: 'M',
      eye_color: 'BLU',
      height: '6\'0"'
    }])
    .select()
    .single();

  if (guestError) {
    console.error("Error inserting guest:", guestError);
    return;
  }

  // Update room 1 to occupied
  await supabase.from('rooms').update({ status: 'occupied' }).eq('id', rooms[0].id);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Insert a dummy stay for room 1
  const { data: stay, error: stayError } = await supabase
    .from('stays')
    .insert([{
      guest_id: guest.id,
      room_id: rooms[0].id,
      rate_type: 'daily',
      rate_amount: 65,
      check_in_date: today,
      check_in_time: '14:00',
      check_out_date: tomorrow,
      check_out_time: '10:00',
      status: 'active'
    }])
    .select()
    .single();

  if (stayError) {
    console.error("Error inserting stay:", stayError);
    return;
  }
  
  console.log("Inserted Dummy Guest and Stay!");
  console.log("Seed complete.");
}

seed();
