import postgres from 'postgres';
import { describe, it } from 'vitest';
import { alias, integer, pgTable, pgView, text } from '~/pg-core';
import { drizzle } from '~/postgres-js';
import { eq, sql } from '~/sql';

const airports = pgTable('airports', {
	id: integer().primaryKey(),
	code: text().notNull(),
});

const flights = pgTable('flights', {
	id: integer().primaryKey(),
	originId: integer('origin_id').notNull(),
	destinationId: integer('destination_id').notNull(),
});

const airportView = pgView('airport_view').as((qb) =>
	qb
		.select({
			id: airports.id,
			code: sql`upper(${airports.code})`.as('code'),
		})
		.from(airports),
);

const db = drizzle(postgres(''));

describe('aliased view', () => {
	it('aliased view Column references use the alias', ({ expect }) => {
		const destination = alias(airportView, 'destination');

		const query = db
			.select({
				flightId: flights.id,
				destinationId: destination.id,
			})
			.from(flights)
			.innerJoin(destination, eq(destination.id, flights.destinationId));

		const result = query.toSQL();

		expect(result.sql).toContain('"destination"."id"');
		expect(result.sql).not.toContain('"airport_view"."id"');
	});

	it('aliased view SQL.Aliased references use the alias', ({ expect }) => {
		const destination = alias(airportView, 'destination');

		const query = db
			.select({
				flightId: flights.id,
				destinationCode: destination.code,
			})
			.from(flights)
			.innerJoin(destination, eq(destination.id, flights.destinationId));

		const result = query.toSQL();

		expect(result.sql).toContain('"destination"."code"');
	});

	it('two aliased views each use their own alias', ({ expect }) => {
		const origin = alias(airportView, 'origin');
		const destination = alias(airportView, 'destination');

		const query = db
			.select({
				flightId: flights.id,
				originId: origin.id,
				destinationId: destination.id,
				originCode: origin.code,
				destinationCode: destination.code,
			})
			.from(flights)
			.innerJoin(origin, eq(origin.id, flights.originId))
			.innerJoin(destination, eq(destination.id, flights.destinationId));

		const result = query.toSQL();

		expect(result.sql).toContain('"origin"."id"');
		expect(result.sql).toContain('"destination"."id"');
		expect(result.sql).toContain('"origin"."code"');
		expect(result.sql).toContain('"destination"."code"');
	});

	it('aliased view join generates correct SQL structure', ({ expect }) => {
		const destination = alias(airportView, 'destination');

		const query = db
			.select({
				flightId: flights.id,
				originId: airportView.id,
				destinationId: destination.id,
				destinationCode: destination.code,
			})
			.from(flights)
			.innerJoin(airportView, eq(airportView.id, flights.originId))
			.innerJoin(destination, eq(destination.id, flights.destinationId));

		const result = query.toSQL();

		expect(result.sql).toContain('inner join "airport_view" on "airport_view"."id" = "flights"."origin_id"');
		expect(result.sql).toContain(
			'inner join "airport_view" "destination" on "destination"."id" = "flights"."destination_id"',
		);
		expect(result.sql).toContain('"destination"."id"');
		expect(result.sql).toContain('"destination"."code"');
	});
});
