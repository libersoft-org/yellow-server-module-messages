import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
 const t = await knex.schema.createTableIfNotExists('messages_reactions', table => {
  table.increments('id').primary();
  table.integer('id_users').notNullable();
  table.string('user_address', 255).notNullable();
  table.string('message_uid', 255).notNullable();
  table.string('emoji_codepoints_rgi', 255).notNullable();
  table.timestamp('created').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

  // table.unique(['id_users', 'message_uid', 'emoji_codepoints_rgi', 'emoji_shortcode'], 'unique_reaction');
 });
}

export async function down(knex: Knex): Promise<void> {
 await knex.schema.dropTableIfExists('messages_reactions');
}
