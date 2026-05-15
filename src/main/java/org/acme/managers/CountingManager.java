package org.acme.managers;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class CountingManager {

    private Logger logger = LoggerFactory.getLogger(getClass());
    private int count;

    public int getCount() {
        return count;
    }

    public void addCount() {
        count += 1;
        logger.info("Successfully added");
        return;
    }
}