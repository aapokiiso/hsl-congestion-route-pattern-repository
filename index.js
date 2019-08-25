'use strict';

const hslGraphQL = require('@aapokiiso/hsl-congestion-graphql-gateway');
const { db } = require('@aapokiiso/hsl-congestion-db-schema');
const routeRepository = require('@aapokiiso/hsl-congestion-route-repository');
const NoSuchRouteError = require('@aapokiiso/hsl-congestion-route-repository/src/no-such-route-error');
const NoSuchRoutePatternError = require('./src/no-such-route-pattern-error');
const CouldNotSaveRoutePatternError = require('./src/could-not-save-route-pattern-error');

module.exports = {
    /**
     * @returns {Promise<Array<object>>}
     */
    getList() {
        return db().models.RoutePattern.findAll();
    },
    /**
     * @param {string} routePatternId
     * @returns {Promise<object>}
     * @throws NoSuchRoutePatternError
     */
    async getById(routePatternId) {
        const pattern = await db().models.RoutePattern.findByPk(routePatternId);

        if (!pattern) {
            throw new NoSuchRoutePatternError(
                `Could not find route pattern with ID '${routePatternId}'`
            );
        }

        return pattern;
    },
    /**
     * @param {string} routePatternId
     * @returns {Promise<object>}
     * @throws CouldNotSaveRoutePatternError
     */
    async createById(routePatternId) {
        try {
            const patternData = await findRoutePatternDataFromApi(routePatternId);

            const { route: routeData } = patternData;
            const { gtfsId: routeId } = routeData;

            // Create route if it doesn't exist yet.
            try {
                await routeRepository.getById(routeId);
            } catch (e) {
                if (e instanceof NoSuchRouteError) {
                    await routeRepository.createById(routeId);
                }
            }

            const { directionId, headsign } = patternData;

            return await createRoutePatternToDb(routePatternId, routeId, directionId, headsign);
        } catch (e) {
            throw new CouldNotSaveRoutePatternError(
                `Could not save route pattern with ID '${routePatternId}'. Reason: ${e.message}`
            );
        }
    },
};

async function findRoutePatternDataFromApi(routePatternId) {
    const { pattern } = await hslGraphQL.query(
        `{
            pattern(id: "${routePatternId}") {
                directionId
                headsign
                route {
                    gtfsId
                }
            }
        }`,
        {
            priority: hslGraphQL.requestPriority.high,
        }
    );

    return pattern;
}

async function createRoutePatternToDb(routePatternId, routeId, directionId, headsign) {
    const [routePattern] = await db().models.RoutePattern.findOrCreate({
        where: {
            id: routePatternId,
            routeId,
            direction: directionId,
            headsign,
        },
    });

    return routePattern;
}
