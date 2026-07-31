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

    @JsonIgnore
    public String passwordHash;

    public boolean isAdmin = false;
}
