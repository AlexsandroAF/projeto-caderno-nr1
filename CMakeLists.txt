cmake_minimum_required(VERSION 3.16)
project(caderno CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

find_package(Drogon CONFIG REQUIRED)

aux_source_directory(controllers CONTROLLER_SRC)

add_executable(${PROJECT_NAME}
    main.cc
    ${CONTROLLER_SRC}
)

target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/controllers
)

target_link_libraries(${PROJECT_NAME} PRIVATE Drogon::Drogon)
