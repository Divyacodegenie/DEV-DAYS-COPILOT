import { and, asc, eq } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export type GameFilters = {
    categoryId?: number | null;
    publisherId?: number | null;
};

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function normalizeFilters(
    filtersOrCategoryId?: GameFilters | number | null,
    publisherId?: number | null,
): GameFilters {
    if (typeof filtersOrCategoryId === 'number' || filtersOrCategoryId === null) {
        return {
            categoryId: typeof filtersOrCategoryId === 'number' ? filtersOrCategoryId : undefined,
            publisherId,
        };
    }

    return filtersOrCategoryId ?? {};
}

function buildGameFilters(filters: GameFilters): Array<ReturnType<typeof eq>> {
    const clauses: Array<ReturnType<typeof eq>> = [];

    if (typeof filters.categoryId === 'number' && Number.isFinite(filters.categoryId)) {
        clauses.push(eq(games.categoryId, filters.categoryId));
    }

    if (typeof filters.publisherId === 'number' && Number.isFinite(filters.publisherId)) {
        clauses.push(eq(games.publisherId, filters.publisherId));
    }

    return clauses;
}

function baseGamesQuery(db: Database, filters: GameFilters = {}) {
    const query = db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));

    const clauses = buildGameFilters(filters);
    if (clauses.length === 0) {
        return query;
    }

    return query.where(and(...clauses));
}

export async function getAllCategories(db: Database): Promise<Array<{ id: number; name: string }>> {
    return db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));
}

export async function getAllPublishers(db: Database): Promise<Array<{ id: number; name: string }>> {
    return db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}

/** All games ordered by title, with optional category and publisher filters. */
export async function getAllGames(
    db: Database,
    filtersOrCategoryId?: GameFilters | number | null,
    publisherId?: number | null,
): Promise<Game[]> {
    const filters = normalizeFilters(filtersOrCategoryId, publisherId);
    const rows = await baseGamesQuery(db, filters).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id))
        .where(eq(games.id, id))
        .get();
    return row ? mapGame(row) : null;
}
