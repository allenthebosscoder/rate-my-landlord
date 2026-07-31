package org.acme;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;

@Entity
@Table(name = "app_user")
public class AppUser extends PanacheEntity {

    @NotBlank
    @Column(unique = true)
    public String username;

    // Nullable: accounts created before this field existed won't have one.
    // Required going forward (enforced in AuthResource, not here) since
    // password reset depends on it.
    @Column(unique = true)
    public String email;

    @JsonIgnore
    public String passwordHash;

    public boolean isAdmin = false;
}
