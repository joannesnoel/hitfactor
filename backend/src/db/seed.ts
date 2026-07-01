import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../config/database.js';
import {
  users,
  userDivisions,
  matches,
  stages,
  matchAdmins,
  matchOfficers,
  shootingRanges,
} from './schema.js';

async function seed() {
  console.log('Seeding database...');

  // Every seeded account uses the password "password" (for testing).
  const passwordHash = await bcrypt.hash('password', 10);

  // Create admin user (owner)
  const [adminUser] = await db
    .insert(users)
    .values({
      email: 'admin@hitfactor.net',
      password_hash: passwordHash,
      display_name: 'Admin',
      roles: ['admin', 'officer', 'shooter'],
      default_division: 'standard',
    })
    .returning();

  await db.insert(userDivisions).values([
    { user_id: adminUser.id, division: 'standard', classification: 'M' },
    { user_id: adminUser.id, division: 'open', classification: 'A' },
    { user_id: adminUser.id, division: 'production_optics', classification: 'GM' },
  ]);

  console.log('Created admin user:', adminUser.email);

  // Create shooting ranges in Cebu, Philippines
  const rangeData = [
    {
      name: 'RJC Shooting Range',
      address: 'Danglag, Consolacion, Cebu',
    },
    {
      name: 'Cebu Wonderland Shooters Club',
      address: 'Lapu-lapu, Cebu',
    },
    {
      name: 'Frontsight Gun Club Inc.',
      address: 'Minglanilla, Cebu',
    },
    {
      name: 'NS Shooting Range',
      address: 'Garing, Consolacion, Cebu',
    },
  ];

  await db.insert(shootingRanges).values(rangeData);
  console.log(`Created ${rangeData.length} shooting ranges in Cebu`);

  // 10 officers: officer1..officer10@hitfactor.com (password "password")
  const officerUsers = await db
    .insert(users)
    .values(
      Array.from({ length: 10 }, (_, i) => ({
        email: `officer${i + 1}@hitfactor.com`,
        display_name: `Officer ${i + 1}`,
        password_hash: passwordHash,
        roles: ['officer', 'shooter'],
      })),
    )
    .returning({ email: users.email });
  console.log(`Created ${officerUsers.length} officers: officer1..officer10@hitfactor.com`);

  // 20 shooters: shooter1..shooter20@hitfactor.com (password "password")
  const shooterNames = [
    'Ricardo Dela Cruz', 'Maria Santos', 'Jose Reyes', 'Ana Garcia', 'Miguel Ramos',
    'Carmen Villanueva', 'Roberto Tan', 'Elena Fernandez', 'Marco Aquino', 'Patricia Lim',
    'Antonio Mendoza', 'Rosa Bautista', 'Fernando Cruz', 'Lucia Navarro', 'Daniel Ocampo',
    'Isabel Soriano', 'Carlos Dizon', 'Teresa Pangilinan', 'Ramon Gutierrez', 'Gloria Espiritu',
  ];
  const shooterUsers = await db
    .insert(users)
    .values(
      shooterNames.map((name, i) => ({
        email: `shooter${i + 1}@hitfactor.com`,
        display_name: name,
        password_hash: passwordHash,
        roles: ['shooter'],
      })),
    )
    .returning({ email: users.email });
  console.log(`Created ${shooterUsers.length} shooters: shooter1..shooter20@hitfactor.com`);

  // Create a sample match
  const [sampleMatch] = await db
    .insert(matches)
    .values({
      name: 'Spring Classic 2026',
      start_date: '2026-04-15',
      end_date: '2026-04-16',
      location: 'Frontsight Gun Club Inc.',
      description:
        'Annual spring PSMOC match. 4 stages with a mix of short and medium courses.',
      level: 'I',
      organization: 'PSMOC',
      status: 'registration',
      created_by: adminUser.id,
      max_shooters: 80,
      registration_open: true,
    })
    .returning();

  console.log('Created match:', sampleMatch.name);

  // Add admin as match admin + MA role
  await db.insert(matchAdmins).values({
    match_id: sampleMatch.id,
    user_id: adminUser.id,
  });

  await db.insert(matchOfficers).values({
    match_id: sampleMatch.id,
    user_id: adminUser.id,
    role: 'MA',
  });

  // Create 4 stages
  const stageData = [
    {
      match_id: sampleMatch.id,
      stage_number: 1,
      name: 'El Presidente',
      description:
        'Start facing up range. On signal, turn, draw, and engage three targets with two rounds each, perform a mandatory reload, and engage the three targets again with two rounds each.',
      scoring_type: 'comstock',
      min_rounds: 12,
      max_points: 60,
      number_of_targets: 3,
      number_of_steel: 0,
      paper_target_rounds: [2, 2, 2],
      is_classifier: true,
      classifier_number: 'CM 99-11',
    },
    {
      match_id: sampleMatch.id,
      stage_number: 2,
      name: 'Speed Drill',
      description:
        'From the start position, engage all targets as they become visible. Targets must be engaged in tactical priority.',
      scoring_type: 'virginia_count',
      min_rounds: 15,
      max_points: 75,
      number_of_targets: 6,
      number_of_steel: 3,
      paper_target_rounds: [2, 2, 2, 2, 2, 2],
      number_of_no_shoots: 2,
    },
    {
      match_id: sampleMatch.id,
      stage_number: 3,
      name: 'Standards',
      description:
        'Fixed time stage. From the ready position, engage the target array in the prescribed order.',
      scoring_type: 'fixed_time',
      min_rounds: 20,
      max_points: 100,
      number_of_targets: 8,
      number_of_steel: 4,
      paper_target_rounds: [2, 2, 2, 2, 2, 2, 2, 2],
      fixed_time: '30.00',
    },
    {
      match_id: sampleMatch.id,
      stage_number: 4,
      name: 'Jungle Run',
      description:
        'Medium course. Engage all targets from within the designated shooting areas. May be engaged in any order.',
      scoring_type: 'comstock',
      min_rounds: 24,
      max_points: 120,
      number_of_targets: 10,
      number_of_steel: 4,
      paper_target_rounds: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      number_of_no_shoots: 3,
    },
  ];

  await db.insert(stages).values(stageData);
  console.log('Created 4 stages');

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
