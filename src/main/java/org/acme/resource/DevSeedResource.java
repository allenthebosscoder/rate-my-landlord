package org.acme.resource;

import io.quarkus.arc.profile.IfBuildProfile;
import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import org.acme.AppUser;
import org.acme.Landlord;
import org.acme.Property;
import org.acme.Review;

/**
 * Debug-only helper to populate the database with random reviews. Only wired up
 * in the "dev" build profile, so it never ships in a packaged/prod build.
 */
@Path("/dev/seed-reviews")
@Produces(MediaType.APPLICATION_JSON)
@IfBuildProfile("dev")
public class DevSeedResource {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String SEED_USERNAME = "devseed";

    private static final String[] LANDLORD_NAMES = {
            "Sunrise Property Management", "Blue Harbor Rentals", "Maple Grove Estates",
            "Skyline Housing Group", "Golden Gate Realty", "Northside Apartments",
            "Riverside Living", "Oakwood Property Partners", "Cedar Point Rentals",
            "Metro Living Solutions"
    };

    // Skewed so seeded reviews pile up on a handful of landlords instead of
    // spreading evenly across all ten — closer to how a real dataset looks,
    // and more useful for testing a single landlord with lots of reviews.
    private static final int[] LANDLORD_WEIGHTS = { 30, 24, 18, 12, 6, 4, 3, 1, 1, 1 };
    private static final int LANDLORD_WEIGHT_TOTAL =
            Arrays.stream(LANDLORD_WEIGHTS).sum();

    private static final String[] CITIES = { "Austin", "Denver", "Seattle", "Chicago", "Miami", "Boston", "Phoenix" };
    private static final String[] STATES = { "TX", "CO", "WA", "IL", "FL", "MA", "AZ" };
    private static final String[] TENANT_NAMES = {
            "Alex Rivera", "Jordan Lee", "Sam Patel", "Taylor Kim", "Morgan Reyes",
            "Casey Nguyen", "Jamie Chen", "Drew Carter", "Riley Brooks", "Avery Diaz"
    };
    private static final String[] COMMENTS = {
            "Maintenance requests took forever to get addressed.",
            "Great communication throughout my lease, would rent again.",
            "Deposit return was a hassle and took months.",
            "Clean building, responsive management, minor noise issues.",
            "Rent increases every year with no real justification.",
            "Had a wonderful experience, staff was always helpful.",
            "Repairs were done quickly whenever something broke.",
            "Lease terms were unclear and not well explained upfront."
    };
    private static final String[] CATEGORY_POOL = { "Communication", "Maintenance", "Value", "Tenant Experience" };

    @POST
    @Transactional
    public Response seed(@QueryParam("count") @DefaultValue("30") int count) {
        int toCreate = Math.min(Math.max(count, 1), 300);
        AppUser seedUser = findOrCreateSeedUser();

        for (int i = 0; i < toCreate; i++) {
            String landlordName = pickWeightedLandlord();
            Landlord landlord = Landlord.find("name", landlordName).firstResult();
            if (landlord == null) {
                landlord = new Landlord();
                landlord.name = landlordName;
                landlord.persist();
            }

            String zipCode = String.valueOf(10000 + RANDOM.nextInt(90000));
            Property property = Property.find("zipCode = ?1 and landlord = ?2", zipCode, landlord).firstResult();
            if (property == null) {
                property = new Property();
                property.zipCode = zipCode;
                property.city = pick(CITIES);
                property.state = pick(STATES);
                property.country = "USA";
                property.landlord = landlord;
                property.persist();
            }

            Review review = new Review();
            review.property = property;
            review.owner = seedUser;
            review.rating = randomRating();
            review.comment = pick(COMMENTS);
            review.tenantName = pick(TENANT_NAMES);
            review.showName = RANDOM.nextBoolean();
            review.tenantLocation = property.city + ", " + property.state;
            review.tenure = randomTenure();
            review.categories = randomCategories();
            review.helpfulCount = RANDOM.nextInt(20);
            review.unhelpfulCount = RANDOM.nextInt(5);
            review.isReported = RANDOM.nextInt(10) == 0;
            review.createdAt = LocalDateTime.now().minusDays(RANDOM.nextInt(365));
            review.updatedAt = review.createdAt;
            review.persist();
        }

        return Response.ok("{\"created\": " + toCreate + "}").build();
    }

    private AppUser findOrCreateSeedUser() {
        AppUser user = AppUser.find("username", SEED_USERNAME).firstResult();
        if (user == null) {
            user = new AppUser();
            user.username = SEED_USERNAME;
            user.passwordHash = BcryptUtil.bcryptHash(UUID.randomUUID().toString());
            user.persist();
        }
        return user;
    }

    private static double randomRating() {
        return 1 + RANDOM.nextInt(9) * 0.5; // 1.0, 1.5, 2.0, ..., 5.0
    }

    private static String randomTenure() {
        int startYear = 2019 + RANDOM.nextInt(5);
        int endYear = startYear + 1 + RANDOM.nextInt(3);
        return startYear + " - " + endYear;
    }

    private static String randomCategories() {
        int n = 1 + RANDOM.nextInt(CATEGORY_POOL.length);
        List<String> pool = new ArrayList<>(Arrays.asList(CATEGORY_POOL));
        Collections.shuffle(pool, RANDOM);
        return String.join(",", pool.subList(0, n));
    }

    private static String pick(String[] options) {
        return options[RANDOM.nextInt(options.length)];
    }

    private static String pickWeightedLandlord() {
        int roll = RANDOM.nextInt(LANDLORD_WEIGHT_TOTAL);
        int cumulative = 0;
        for (int i = 0; i < LANDLORD_WEIGHTS.length; i++) {
            cumulative += LANDLORD_WEIGHTS[i];
            if (roll < cumulative) {
                return LANDLORD_NAMES[i];
            }
        }
        return LANDLORD_NAMES[LANDLORD_NAMES.length - 1];
    }
}
