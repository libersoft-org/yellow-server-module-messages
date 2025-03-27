import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
 await knex.schema.createTable('messages', table => {
  table.increments('id').primary();
  table.integer('id_users');
  table.string('uid', 255).notNullable();
  table.string('address_from', 255).notNullable();
  table.string('address_to', 255).notNullable();
  table.text('message').notNullable();
  table.string('format', 16).notNullable().defaultTo('plaintext');
  table.timestamp('seen').nullable();
  table.timestamp('created').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
 });

 await knex.schema.createTable('attachments', table => {
  table.uuid('id').primary();
  table.uuid('file_transfer_id').notNullable();
  table.integer('user_id').unsigned().notNullable();
  table.text('file_path').nullable();
  table.timestamp('created').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
 });

 await knex.schema.createTable('file_uploads', table => {
  table.uuid('id').primary();
  table.integer('from_user_id').unsigned().notNullable();
  table.string('from_user_uid', 255).notNullable();
  table.string('type', 255).notNullable();
  table.string('status', 255).notNullable();
  table.string('error_type', 255).nullable();
  table.text('file_original_name').notNullable();
  table.text('file_mime_type').notNullable();
  table.bigInteger('file_size').unsigned().notNullable();
  table.text('file_name').nullable();
  table.text('file_folder').nullable();
  table.text('file_extension').nullable();
  table.integer('chunk_size').unsigned().notNullable();
  table.json('chunks_received').notNullable().defaultTo('[]');
  table.timestamp('created').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.json('metadata').nullable();
 });
}

export async function down(knex: Knex): Promise<void> {
 await knex.schema.dropTableIfExists('file_uploads');
 await knex.schema.dropTableIfExists('attachments');
 await knex.schema.dropTableIfExists('messages');
}
