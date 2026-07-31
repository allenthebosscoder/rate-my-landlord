package org.acme;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToOne;

import java.time.LocalDateTime;

@Entity
public class AuthToken extends PanacheEntity {

    @Column(unique = true, nullable = false)
    public String token;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JsonIgnore
    public AppUser user;

    public LocalDateTime expiresAt;
}
