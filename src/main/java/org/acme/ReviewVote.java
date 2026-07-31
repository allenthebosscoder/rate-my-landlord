package org.acme;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = { "review_id", "user_id" }))
public class ReviewVote extends PanacheEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    public Review review;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    public AppUser user;

    public String voteType; // "HELPFUL" or "UNHELPFUL"
}
