#include "user_service.hpp"
#include <algorithm>

namespace Services {

std::optional<User> UserService::getUser(int id) {
    auto it = std::find_if(users_.begin(), users_.end(),
        [id](const User& u) { return u.getId() == id; });
    
    if (it != users_.end()) {
        return *it;
    }
    return std::nullopt;
}

std::vector<User> UserService::getAllUsers() {
    return users_;
}

User UserService::createUser(const User& user) {
    users_.push_back(user);
    return user;
}

std::optional<User> UserService::updateUser(int id, const User& updates) {
    auto it = std::find_if(users_.begin(), users_.end(),
        [id](const User& u) { return u.getId() == id; });
    
    if (it != users_.end()) {
        it->setName(updates.getName());
        it->setEmail(updates.getEmail());
        return *it;
    }
    return std::nullopt;
}

bool UserService::deleteUser(int id) {
    auto it = std::find_if(users_.begin(), users_.end(),
        [id](const User& u) { return u.getId() == id; });
    
    if (it != users_.end()) {
        users_.erase(it);
        return true;
    }
    return false;
}

} // namespace Services