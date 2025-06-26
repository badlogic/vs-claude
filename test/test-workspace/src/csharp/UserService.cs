using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace TestApp.Services
{
    public interface IUserService
    {
        Task<User> GetUserAsync(int id);
        Task<List<User>> GetAllUsersAsync();
        Task<User> CreateUserAsync(User user);
        Task<User> UpdateUserAsync(int id, User user);
        Task<bool> DeleteUserAsync(int id);
    }

    public class User
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
    }

    public class UserService : IUserService
    {
        private readonly List<User> _users = new List<User>();

        public UserService()
        {
            // Initialize with some test data
        }

        public async Task<User> GetUserAsync(int id)
        {
            await Task.Delay(10); // Simulate async operation
            return _users.FirstOrDefault(u => u.Id == id);
        }

        public async Task<List<User>> GetAllUsersAsync()
        {
            await Task.Delay(10);
            return _users.ToList();
        }

        public async Task<User> CreateUserAsync(User user)
        {
            await Task.Delay(10);
            _users.Add(user);
            return user;
        }

        public async Task<User> UpdateUserAsync(int id, User user)
        {
            await Task.Delay(10);
            var existingUser = _users.FirstOrDefault(u => u.Id == id);
            if (existingUser != null)
            {
                existingUser.Name = user.Name;
                existingUser.Email = user.Email;
            }
            return existingUser;
        }

        public async Task<bool> DeleteUserAsync(int id)
        {
            await Task.Delay(10);
            var user = _users.FirstOrDefault(u => u.Id == id);
            if (user != null)
            {
                _users.Remove(user);
                return true;
            }
            return false;
        }
    }

    public class UserController
    {
        private readonly IUserService _userService;

        public UserController(IUserService userService)
        {
            _userService = userService;
        }

        public async Task<User> GetUser(int id)
        {
            return await _userService.GetUserAsync(id);
        }
    }
}