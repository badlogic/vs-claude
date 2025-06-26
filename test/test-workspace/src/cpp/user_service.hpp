#ifndef USER_SERVICE_HPP
#define USER_SERVICE_HPP

#include <string>
#include <vector>
#include <memory>
#include <optional>

namespace Services {

class User {
public:
    User(int id, const std::string& name, const std::string& email)
        : id_(id), name_(name), email_(email) {}

    int getId() const { return id_; }
    void setId(int id) { id_ = id; }

    const std::string& getName() const { return name_; }
    void setName(const std::string& name) { name_ = name; }

    const std::string& getEmail() const { return email_; }
    void setEmail(const std::string& email) { email_ = email; }

private:
    int id_;
    std::string name_;
    std::string email_;
};

class IUserService {
public:
    virtual ~IUserService() = default;
    
    virtual std::optional<User> getUser(int id) = 0;
    virtual std::vector<User> getAllUsers() = 0;
    virtual User createUser(const User& user) = 0;
    virtual std::optional<User> updateUser(int id, const User& user) = 0;
    virtual bool deleteUser(int id) = 0;
};

class UserService : public IUserService {
public:
    UserService() = default;
    
    std::optional<User> getUser(int id) override;
    std::vector<User> getAllUsers() override;
    User createUser(const User& user) override;
    std::optional<User> updateUser(int id, const User& user) override;
    bool deleteUser(int id) override;

private:
    std::vector<User> users_;
};

class UserController {
public:
    explicit UserController(std::shared_ptr<IUserService> service)
        : userService_(service) {}

    std::optional<User> handleGetUser(int id) {
        return userService_->getUser(id);
    }

    std::vector<User> handleGetAllUsers() {
        return userService_->getAllUsers();
    }

private:
    std::shared_ptr<IUserService> userService_;
};

} // namespace Services

#endif // USER_SERVICE_HPP