package org.acme;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToOne;

import java.time.LocalDateTime;

@Entity
public class PasswordResetToken extends PanacheEntity {

    public String token;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    public AppUser user;

    public LocalDateTime expiresAt;

    public boolean used = false;
}
