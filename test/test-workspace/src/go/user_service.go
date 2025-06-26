package services

import (
	"errors"
	"sync"
)

// User represents a user in the system
type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// UserService interface defines user operations
type UserService interface {
	GetUser(id int) (*User, error)
	GetAllUsers() ([]*User, error)
	CreateUser(user *User) (*User, error)
	UpdateUser(id int, user *User) (*User, error)
	DeleteUser(id int) error
}

// userServiceImpl implements UserService
type userServiceImpl struct {
	users []*User
	mu    sync.RWMutex
}

// NewUserService creates a new UserService instance
func NewUserService() UserService {
	return &userServiceImpl{
		users: make([]*User, 0),
	}
}

// GetUser retrieves a user by ID
func (s *userServiceImpl) GetUser(id int) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, user := range s.users {
		if user.ID == id {
			return user, nil
		}
	}
	return nil, errors.New("user not found")
}

// GetAllUsers returns all users
func (s *userServiceImpl) GetAllUsers() ([]*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*User, len(s.users))
	copy(result, s.users)
	return result, nil
}

// CreateUser creates a new user
func (s *userServiceImpl) CreateUser(user *User) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.users = append(s.users, user)
	return user, nil
}

// UpdateUser updates an existing user
func (s *userServiceImpl) UpdateUser(id int, updates *User) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, user := range s.users {
		if user.ID == id {
			s.users[i].Name = updates.Name
			s.users[i].Email = updates.Email
			return s.users[i], nil
		}
	}
	return nil, errors.New("user not found")
}

// DeleteUser removes a user by ID
func (s *userServiceImpl) DeleteUser(id int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, user := range s.users {
		if user.ID == id {
			s.users = append(s.users[:i], s.users[i+1:]...)
			return nil
		}
	}
	return errors.New("user not found")
}

// UserController handles HTTP requests for users
type UserController struct {
	service UserService
}

// NewUserController creates a new UserController
func NewUserController(service UserService) *UserController {
	return &UserController{
		service: service,
	}
}

// HandleGetUser handles getting a user by ID
func (c *UserController) HandleGetUser(id int) (*User, error) {
	return c.service.GetUser(id)
}

// HandleGetAllUsers handles getting all users
func (c *UserController) HandleGetAllUsers() ([]*User, error) {
	return c.service.GetAllUsers()
}