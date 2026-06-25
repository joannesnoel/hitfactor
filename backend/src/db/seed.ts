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

  const passwordHash = await bcrypt.hash('password123', 10);
  // The owner admin account uses its own password (the other test users below
  // keep password123). Recreated on every reset/seed.
  const adminPasswordHash = await bcrypt.hash('password', 10);

  // Create admin user (owner)
  const [adminUser] = await db
    .insert(users)
    .values({
      email: 'admin@hitfactor.com',
      password_hash: adminPasswordHash,
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

  // Create officer user
  const [officerUser] = await db
    .insert(users)
    .values({
      email: 'officer@hitfactor.com',
      password_hash: passwordHash,
      display_name: 'Range Officer',
      roles: ['officer', 'shooter'],
      default_division: 'production_optics',
    })
    .returning();

  await db.insert(userDivisions).values([
    { user_id: officerUser.id, division: 'production_optics', classification: 'A' },
    { user_id: officerUser.id, division: 'production', classification: 'B' },
  ]);

  console.log('Created officer user:', officerUser.email);

  // Create shooter user
  const [shooterUser] = await db
    .insert(users)
    .values({
      email: 'shooter@hitfactor.com',
      password_hash: passwordHash,
      display_name: 'Test Shooter',
      roles: ['shooter'],
      default_division: 'production',
      member_number: 'TY12345',
    })
    .returning();

  await db.insert(userDivisions).values([
    { user_id: shooterUser.id, division: 'production', classification: 'B' },
    { user_id: shooterUser.id, division: 'standard', classification: 'C' },
    { user_id: shooterUser.id, division: 'classic', classification: 'D' },
  ]);

  console.log('Created shooter user:', shooterUser.email);

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

  // Create 20 match officers (Filipino names)
  const officerNames = [
    { display_name: 'Ricardo Dela Cruz', email: 'ricardo.delacruz@hitfactor.com' },
    { display_name: 'Maria Santos', email: 'maria.santos@hitfactor.com' },
    { display_name: 'Jose Reyes', email: 'jose.reyes@hitfactor.com' },
    { display_name: 'Ana Garcia', email: 'ana.garcia@hitfactor.com' },
    { display_name: 'Miguel Ramos', email: 'miguel.ramos@hitfactor.com' },
    { display_name: 'Carmen Villanueva', email: 'carmen.villanueva@hitfactor.com' },
    { display_name: 'Roberto Tan', email: 'roberto.tan@hitfactor.com' },
    { display_name: 'Elena Fernandez', email: 'elena.fernandez@hitfactor.com' },
    { display_name: 'Marco Aquino', email: 'marco.aquino@hitfactor.com' },
    { display_name: 'Patricia Lim', email: 'patricia.lim@hitfactor.com' },
    { display_name: 'Antonio Mendoza', email: 'antonio.mendoza@hitfactor.com' },
    { display_name: 'Rosa Bautista', email: 'rosa.bautista@hitfactor.com' },
    { display_name: 'Fernando Cruz', email: 'fernando.cruz@hitfactor.com' },
    { display_name: 'Lucia Navarro', email: 'lucia.navarro@hitfactor.com' },
    { display_name: 'Daniel Ocampo', email: 'daniel.ocampo@hitfactor.com' },
    { display_name: 'Isabel Soriano', email: 'isabel.soriano@hitfactor.com' },
    { display_name: 'Carlos Dizon', email: 'carlos.dizon@hitfactor.com' },
    { display_name: 'Teresa Pangilinan', email: 'teresa.pangilinan@hitfactor.com' },
    { display_name: 'Ramon Gutierrez', email: 'ramon.gutierrez@hitfactor.com' },
    { display_name: 'Gloria Espiritu', email: 'gloria.espiritu@hitfactor.com' },
  ];

  await db.insert(users).values(
    officerNames.map((o) => ({
      ...o,
      password_hash: passwordHash,
      roles: ['officer', 'shooter'],
    })),
  );

  console.log(`Created ${officerNames.length} match officers`);

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
