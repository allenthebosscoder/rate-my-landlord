package org.acme;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.validation.constraints.NotBlank;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;
import java.util.ArrayList;

@Entity
public class Property extends PanacheEntity {

    @NotBlank
    public String zipCode;

    public String city;

    public String state;

    @NotBlank
    public String country;

    @ManyToOne(fetch = FetchType.EAGER)
    public Landlord landlord;

    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    public List<Review> reviews = new ArrayList<>();
}

