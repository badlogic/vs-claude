#ifndef USER_SERVICE_H
#define USER_SERVICE_H

#include <stdbool.h>

#define MAX_USERS 100
#define MAX_NAME_LENGTH 50
#define MAX_EMAIL_LENGTH 100

typedef struct {
    int id;
    char name[MAX_NAME_LENGTH];
    char email[MAX_EMAIL_LENGTH];
} User;

typedef struct {
    User users[MAX_USERS];
    int count;
} UserService;

// Initialize the user service
void user_service_init(UserService* service);

// Get a user by ID
User* user_service_get_user(UserService* service, int id);

// Get all users
int user_service_get_all_users(UserService* service, User* buffer, int buffer_size);

// Create a new user
bool user_service_create_user(UserService* service, const User* user);

// Update an existing user
bool user_service_update_user(UserService* service, int id, const User* updates);

// Delete a user
bool user_service_delete_user(UserService* service, int id);

// Controller functions
typedef struct {
    UserService* service;
} UserController;

void user_controller_init(UserController* controller, UserService* service);
User* user_controller_handle_get_user(UserController* controller, int id);
int user_controller_handle_get_all_users(UserController* controller, User* buffer, int buffer_size);

#endif // USER_SERVICE_H