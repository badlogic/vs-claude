package com.example.services;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

public interface UserService {
    CompletableFuture<User> getUser(int id);
    CompletableFuture<List<User>> getAllUsers();
    CompletableFuture<User> createUser(User user);
    CompletableFuture<User> updateUser(int id, User user);
    CompletableFuture<Boolean> deleteUser(int id);
}

class User {
    private int id;
    private String name;
    private String email;

    public User(int id, String name, String email) {
        this.id = id;
        this.name = name;
        this.email = email;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}

class UserServiceImpl implements UserService {
    private final List<User> users = new ArrayList<>();

    public UserServiceImpl() {
        // Initialize with some test data
    }

    @Override
    public CompletableFuture<User> getUser(int id) {
        return CompletableFuture.supplyAsync(() -> {
            return users.stream()
                .filter(u -> u.getId() == id)
                .findFirst()
                .orElse(null);
        });
    }

    @Override
    public CompletableFuture<List<User>> getAllUsers() {
        return CompletableFuture.supplyAsync(() -> {
            return new ArrayList<>(users);
        });
    }

    @Override
    public CompletableFuture<User> createUser(User user) {
        return CompletableFuture.supplyAsync(() -> {
            users.add(user);
            return user;
        });
    }

    @Override
    public CompletableFuture<User> updateUser(int id, User updates) {
        return CompletableFuture.supplyAsync(() -> {
            for (User user : users) {
                if (user.getId() == id) {
                    user.setName(updates.getName());
                    user.setEmail(updates.getEmail());
                    return user;
                }
            }
            return null;
        });
    }

    @Override
    public CompletableFuture<Boolean> deleteUser(int id) {
        return CompletableFuture.supplyAsync(() -> {
            return users.removeIf(u -> u.getId() == id);
        });
    }
}

class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    public CompletableFuture<User> handleGetUser(int id) {
        return userService.getUser(id);
    }

    public CompletableFuture<List<User>> handleGetAllUsers() {
        return userService.getAllUsers();
    }
}