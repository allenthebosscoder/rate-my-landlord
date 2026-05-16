package org.acme;

public class Review {

    public int id;
    public String landlord;
    public int rating;
    public String comment;

    public Review() {
    }

    public Review(int id, String landlord, int rating, String comment) {
        this.id = id;
        this.landlord = landlord;
        this.rating = rating;
        this.comment = comment;
    }
}